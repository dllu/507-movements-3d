import * as THREE from 'three';
import {makeBoredPlanarLink, boredPlanarLinkGeometry} from './bored-planar-link.js';
import {capsule, circle, poly, plate, polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function boredBoss(radius, depth, boreRadius, material) {
  return new THREE.Mesh(boredPlanarLinkGeometry({
    length: 0, width: radius * 2, eyeRadius: radius, boreRadius, depth,
  }), material);
}

// Finite tapered lever, with different eyes at the shaft and driven pin.
function boredGabLever(end, {startRadius, endRadius, startBore, endBore, depth, width}, material) {
  const length = Math.hypot(end.x, end.y);
  const startHalfWidth = width === undefined ? startRadius * .72 : width / 2;
  const endHalfWidth = width === undefined ? endRadius * .72 : width / 2;
  const outline = polygonClipping.union(
    poly(circle([0, 0], startRadius, 64)),
    poly(circle([length, 0], endRadius, 64)),
    poly([[0, -startHalfWidth], [length, -endHalfWidth],
      [length, endHalfWidth], [0, startHalfWidth]]),
  );
  const bores = [{x: 0, y: 0, radius: startBore}];
  if (endBore > 0) bores.push({x: length, y: 0, radius: endBore});
  const geometry = plate(polygonClipping.difference(outline,
    ...bores.map(bore => poly(circle([bore.x, bore.y], bore.radius, 64)))), -depth / 2, depth / 2);
  geometry.userData.bores = bores;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.z = Math.atan2(end.y, end.x);
  return mesh;
}

function rotate2(angle, point) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function boredCamHandle(points, radius, boreRadius, material) {
  const curve = new THREE.SplineCurve(points), left = [], right = [];
  for (let i = 0; i <= 128; i++) {
    const p = curve.getPoint(i / 128), tangent = curve.getTangent(i / 128);
    left.push([p.x - radius * tangent.y, p.y + radius * tangent.x]);
    right.push([p.x + radius * tangent.y, p.y - radius * tangent.x]);
  }
  const outline = polygonClipping.union(poly([...left, ...right.reverse()]), poly(circle([0, 0], .20, 64)));
  return new THREE.Mesh(plate(polygonClipping.difference(outline,
    poly(circle([0, 0], boreRadius, 64))), -radius, radius), material);
}

// A round cam toe bears on a flat shoulder. Rocking the free handle resolves
// the changing rod/support pose without prescribing a penetrated contact.
function camAngleOnShoulder(pivot, toe, support, normal, commandedAngle) {
  const residual = rotate2(commandedAngle, toe).add(pivot).sub(support).dot(normal);
  if (Math.abs(residual) < 1e-13) return commandedAngle;
  const projection = support.clone().sub(pivot).dot(normal) / toe.length();
  if (Math.abs(projection) > 1 + 1e-12) throw new RangeError('Gab cam cannot reach its shoulder');
  const supportAngle = Math.atan2(normal.y, normal.x) - Math.PI / 2;
  const toeAngle = Math.atan2(toe.y, toe.x);
  const angle = Math.asin(THREE.MathUtils.clamp(projection, -1, 1));
  return [angle, Math.PI - angle].map(candidate => {
    const result = supportAngle + candidate - toeAngle;
    return commandedAngle + THREE.MathUtils.euclideanModulo(result - commandedAngle + Math.PI, FULL_TURN) - Math.PI;
  }).sort((a, b) => Math.abs(a - commandedAngle) - Math.abs(b - commandedAngle))[0];
}

function pointInPose(position, angle, localPoint) {
  return rotate2(angle, localPoint).add(position);
}

function smootherstepLaw(normalized) {
  const value = normalized ** 3 * (
    normalized * (normalized * 6 - 15) + 10
  );
  const firstDerivative = 30 * normalized ** 2 * (1 - normalized) ** 2;
  const secondDerivative = 60 * normalized
    * (1 - normalized)
    * (1 - 2 * normalized);
  return { firstDerivative, secondDerivative, value };
}

function c2BumpLaw(normalized) {
  const value = 64 * normalized ** 3 * (1 - normalized) ** 3;
  const firstDerivative = 192 * normalized ** 2
    * (1 - normalized) ** 2
    * (1 - 2 * normalized);
  return { firstDerivative, value };
}

function transitionLaw(phase, start, end, from, to) {
  const duration = end - start;
  const normalized = THREE.MathUtils.clamp(
    (phase - start) / duration,
    0,
    1,
  );
  const smooth = smootherstepLaw(normalized);
  return {
    accelerationPerPhaseSquared:
      (to - from) * smooth.secondDerivative / duration ** 2,
    ratePerPhase: (to - from) * smooth.firstDerivative / duration,
    value: THREE.MathUtils.lerp(from, to, smooth.value),
  };
}

function bumpLaw(phase, start, end, amplitude) {
  const duration = end - start;
  const normalized = THREE.MathUtils.clamp(
    (phase - start) / duration,
    0,
    1,
  );
  const bump = c2BumpLaw(normalized);
  return {
    ratePerPhase: amplitude * bump.firstDerivative / duration,
    value: amplitude * bump.value,
  };
}

function makeTube(points, radius, material, z = 0, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, point.z ?? z)),
    closed,
    'centripetal',
  );
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(64, points.length * 18), radius, 12, closed),
    material,
  );
}

// A flat spring strap of rectangular section, Brown's double-line strap. Its
// centerline is rebuilt each frame; the width lies in the drawing plane.
function makeFlatStrap(maxPoints, width, depth, material) {
  const faces = 4, perRing = faces * 2;
  const positions = new Float32Array((maxPoints * perRing + 8) * 3);
  const index = [];
  for (let i = 0; i < maxPoints - 1; i++) for (let f = 0; f < faces; f++) {
    const a = i * perRing + f * 2, b = a + 1, c = a + perRing, d = b + perRing;
    index.push(a, c, b, b, c, d);
  }
  const capStart = maxPoints * perRing;
  index.push(capStart, capStart + 1, capStart + 2, capStart, capStart + 2, capStart + 3);
  index.push(capStart + 4, capStart + 6, capStart + 5, capStart + 4, capStart + 7, capStart + 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  const corner = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  mesh.userData.setPoints = (points) => {
    if (points.length !== maxPoints) throw new RangeError('Strap point count changed');
    const rings = points.map((point, i) => {
      const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const tx = next.x - previous.x, ty = next.y - previous.y, length = Math.hypot(tx, ty) || 1;
      const nx = -ty / length, ny = tx / length;
      return corner.map(([s, t]) => [point.x + nx * s * width / 2, point.y + ny * s * width / 2, point.z + t * depth / 2]);
    });
    rings.forEach((ring, i) => {
      for (let f = 0; f < faces; f++) for (let k = 0; k < 2; k++) {
        positions.set(ring[(f + k) % 4], (i * perRing + f * 2 + k) * 3);
      }
    });
    [rings[0], rings.at(-1)].forEach((ring, e) => ring.forEach((p, k) => positions.set(p, (capStart + e * 4 + k) * 3)));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  return mesh;
}

// Extrude an outline traced in source raster pixels into a finite plate.
function sourcePlate(outlines, toLocal, low, high, material, holes = [], smooth = false) {
  const smoothRing = (points) => new THREE.CatmullRomCurve3(
    points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal',
  ).getSpacedPoints(Math.max(96, points.length * 6)).slice(0, -1).map((p) => [p.x, p.y]);
  const toRing = (points) => (smooth ? smoothRing(points) : points).map((point) => {
    const local = toLocal(new THREE.Vector2(point[0], point[1]));
    return [local.x, local.y];
  });
  let shape = polygonClipping.union(...outlines.map((outline) => (
    Array.isArray(outline[0]?.[0]?.[0]) ? outline : poly(toRing(outline))
  )));
  if (holes.length) shape = polygonClipping.difference(shape, ...holes);
  return new THREE.Mesh(plate(shape, low, high), material);
}

function distanceToRectangle(point, minimum, maximum) {
  const dx = Math.max(minimum.x - point.x, 0, point.x - maximum.x);
  const dy = Math.max(minimum.y - point.y, 0, point.y - maximum.y);
  return Math.hypot(dx, dy);
}

function springHandleGabDisengager() {
  const root = new THREE.Group();

  // Brown's square engraving is measured about the gab-pin center. One scale
  // maps its valve-rocker axis, cam pivot, handle grip, spring loop, and notch
  // a into a common model plane; z is then used only to separate the nested
  // physical plates and the through-pins that join them.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterGabPin = new THREE.Vector2(270, 250);
  const sourceRasterValvePivot = new THREE.Vector2(260, 62);
  const sourceRasterCamPivot = new THREE.Vector2(341, 242);
  const sourceRasterHandleGrip = new THREE.Vector2(485, 212);
  const sourceRasterCamContact = new THREE.Vector2(285, 151);
  const sourceRasterNotchA = new THREE.Vector2(480, 319);
  const sourceRasterSpringAnchor = new THREE.Vector2(358, 266);
  const sourceRasterSpringBottom = new THREE.Vector2(450, 494);
  const sourceRasterSpringFreeTip = new THREE.Vector2(468, 321);
  const sourceUnitsPerPixel = 0.015;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterGabPin.x) * sourceUnitsPerPixel,
    (sourceRasterGabPin.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceRasterFromPoint = (point) => new THREE.Vector2(
    sourceRasterGabPin.x + point.x / sourceUnitsPerPixel,
    sourceRasterGabPin.y - point.y / sourceUnitsPerPixel,
  );

  const valvePivot = sourcePointFromRaster(sourceRasterValvePivot);
  const valvePinLocal = valvePivot.clone().multiplyScalar(-1);
  const valveArmLength = valvePinLocal.length();
  const valveRockerAmplitude = 0.12;
  const camPivotLocal = sourcePointFromRaster(sourceRasterCamPivot);
  const sourceHandleGrip = sourcePointFromRaster(sourceRasterHandleGrip);
  const handleGripLocal = sourceHandleGrip.clone().sub(camPivotLocal);
  const maximumHandleAngle = 0.75;
  const camToeRadius = .145;
  const camSupportHalfLength = .82;
  // Sampled toe travel spans -1.044..0.265 along the shoulder.
  const camSupportRearReach = 1.10;
  const camSupportFrontReach = .32;
  const sourceCamContact = sourcePointFromRaster(sourceRasterCamContact);
  const camContactLocal = sourceCamContact.clone().sub(camPivotLocal);
  const camContactSourceHeight = camPivotLocal.y + camContactLocal.y;
  const camSupportValveLocal = sourceCamContact.clone().sub(valvePivot);
  const sourceNotchA = sourcePointFromRaster(sourceRasterNotchA);
  const camNotchALocal = sourceNotchA.clone().sub(camPivotLocal);
  const springHandleAnchorLocal = sourcePointFromRaster(
    sourceRasterSpringAnchor,
  );
  const springRestPathLocal = [
    sourceRasterSpringAnchor,
    new THREE.Vector2(398, 290),
    new THREE.Vector2(428, 345),
    new THREE.Vector2(458, 440),
    sourceRasterSpringBottom,
    new THREE.Vector2(412, 470),
    new THREE.Vector2(390, 400),
    new THREE.Vector2(392, 352),
    new THREE.Vector2(410, 331),
    new THREE.Vector2(440, 324),
    sourceRasterSpringFreeTip,
  ].map(sourcePointFromRaster);
  // Rod-local depth of each rest point: the strap from the rod lies in front;
  // the free end passes behind it into the plane of notch a.
  const springRestDepths = [.75, .75, .75, .75, .75, .75, .73, .68, .63, .62, .62];
  const springRestTipLocal = springRestPathLocal.at(-1).clone();
  const springMaximumDeflection = 0.14;
  const springStrapPoints = 49;
  const rodCrownRadius = 0.795;

  // Plate: a 19-pixel pin in a slot cut up through the rod (y 230-268)
  // into its round crown; the rod bar itself forms both jaws.
  const gabPinRadius = 0.26;
  const gabInnerHalfWidth = gabPinRadius + 0.04;
  const gabJawWidth = 0.5;
  const gabMouthDepth = 0.27;
  const gabTopBridgeMinimumY = 0.30;
  const gabTopBridgeMaximumY = 0.79;
  const fullClearCouplingStart = gabMouthDepth + gabPinRadius + 0.04;
  const fullClearCouplingEnd = fullClearCouplingStart + 0.06;

  const handleLiftAtAngle = (handleAngle) => camContactLocal.y
    - rotate2(handleAngle, camContactLocal).y;
  const maximumGabLift = handleLiftAtAngle(maximumHandleAngle);
  if (maximumGabLift <= fullClearCouplingEnd) {
    throw new RangeError('Movement 186 cam cannot lift the gab clear of its pin.');
  }

  const cyclePeriod = 18;
  const inputTurnsPerCycle = 6;
  const sequenceBreaks = Object.freeze({
    sourceEngagedHoldEnd: 0.18,
    springSnapStart: 0.28,
    handlePullEnd: 0.32,
    latchedHoldEnd: 0.58,
    springReleaseEnd: 0.64,
    handleLowerEnd: 0.80,
  });

  const inputMotionAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let turns = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 2,
    };
    if (phase < sequenceBreaks.sourceEngagedHoldEnd) {
      turns = transitionLaw(
        phase,
        0,
        sequenceBreaks.sourceEngagedHoldEnd,
        0,
        2,
      );
    } else if (phase < sequenceBreaks.handlePullEnd) {
      turns.value = 2;
    } else if (phase < sequenceBreaks.latchedHoldEnd) {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handlePullEnd,
        sequenceBreaks.latchedHoldEnd,
        2,
        4,
      );
    } else if (phase < sequenceBreaks.handleLowerEnd) {
      turns.value = 4;
    } else {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLowerEnd,
        1,
        4,
        inputTurnsPerCycle,
      );
    }
    return {
      accelerationPerPhaseSquared:
        FULL_TURN * turns.accelerationPerPhaseSquared,
      angle: FULL_TURN * turns.value,
      phase,
      ratePerPhase: FULL_TURN * turns.ratePerPhase,
      turns: turns.value,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let handle = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.sourceEngagedHoldEnd
        && phase < sequenceBreaks.handlePullEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.sourceEngagedHoldEnd,
        sequenceBreaks.handlePullEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handlePullEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      handle.value = 1;
    } else if (
      phase >= sequenceBreaks.springReleaseEnd
        && phase < sequenceBreaks.handleLowerEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.springReleaseEnd,
        sequenceBreaks.handleLowerEnd,
        1,
        0,
      );
    }

    let latch = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.springSnapStart
        && phase < sequenceBreaks.handlePullEnd
    ) {
      latch = transitionLaw(
        phase,
        sequenceBreaks.springSnapStart,
        sequenceBreaks.handlePullEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handlePullEnd
        && phase < sequenceBreaks.latchedHoldEnd
    ) {
      latch.value = 1;
    } else if (
      phase >= sequenceBreaks.latchedHoldEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      latch = transitionLaw(
        phase,
        sequenceBreaks.latchedHoldEnd,
        sequenceBreaks.springReleaseEnd,
        1,
        0,
      );
    }

    let spring = { ratePerPhase: 0, value: 0 };
    if (
      phase >= sequenceBreaks.springSnapStart
        && phase < sequenceBreaks.handlePullEnd
    ) {
      spring = bumpLaw(
        phase,
        sequenceBreaks.springSnapStart,
        sequenceBreaks.handlePullEnd,
        -springMaximumDeflection,
      );
    } else if (
      phase >= sequenceBreaks.latchedHoldEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      spring = bumpLaw(
        phase,
        sequenceBreaks.latchedHoldEnd,
        sequenceBreaks.springReleaseEnd,
        springMaximumDeflection,
      );
    }

    let stage = 'engaged-eccentric-rod-driving-valve-gear';
    if (
      phase >= sequenceBreaks.sourceEngagedHoldEnd
        && phase < sequenceBreaks.springSnapStart
    ) stage = 'pulling-spring-handle-cam-lifting-gab';
    else if (
      phase >= sequenceBreaks.springSnapStart
        && phase < sequenceBreaks.handlePullEnd
    ) stage = 'spring-handle-passing-notch-a';
    else if (
      phase >= sequenceBreaks.handlePullEnd
        && phase < sequenceBreaks.latchedHoldEnd
    ) stage = 'spring-handle-latched-gab-clear-of-pin';
    else if (
      phase >= sequenceBreaks.latchedHoldEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) stage = 'spring-handle-flexing-out-of-notch-a';
    else if (
      phase >= sequenceBreaks.springReleaseEnd
        && phase < sequenceBreaks.handleLowerEnd
    ) stage = 'cam-lowering-gab-around-valve-pin';
    else if (phase >= sequenceBreaks.handleLowerEnd) {
      stage = 'gab-recaptured-eccentric-rod-driving-valve-gear';
    }

    return {
      handleAccelerationPerPhaseSquared:
        handle.accelerationPerPhaseSquared,
      handleFraction: handle.value,
      handleRatePerPhase: handle.ratePerPhase,
      latchAccelerationPerPhaseSquared:
        latch.accelerationPerPhaseSquared,
      latchEngagement: latch.value,
      latchRatePerPhase: latch.ratePerPhase,
      phase,
      springDeflection: spring.value,
      springDeflectionRatePerPhase: spring.ratePerPhase,
      stage,
    };
  };

  const notchALocalAtHandleAngle = (handleAngle) => camPivotLocal
    .clone()
    .add(rotate2(handleAngle, camNotchALocal));
  const springHandlePointsAtConfiguration = ({
    handleAngle,
    handleFraction,
    springDeflection,
  }) => {
    const notchALocal = notchALocalAtHandleAngle(handleAngle);
    const desiredTip = springRestTipLocal.clone().lerp(
      notchALocal,
      handleFraction,
    );
    const tipDisplacement = desiredTip.clone().sub(springRestTipLocal);
    return springRestPathLocal.map((restPoint, index) => {
      const normalized = index / (springRestPathLocal.length - 1);
      const bendWeight = smootherstepLaw(normalized).value;
      return new THREE.Vector3(
        restPoint.x + tipDisplacement.x * bendWeight,
        restPoint.y + tipDisplacement.y * bendWeight,
        springRestDepths[index] + springDeflection * bendWeight,
      );
    });
  };

  const stateAtConfiguration = ({
    handleAcceleration = 0,
    handleAngularVelocity = 0,
    handleFraction = 0,
    inputAngle = 0,
    latchEngagement = 0,
    springDeflection = 0,
  }) => {
    const resolvedInputAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const resolvedHandleFraction = THREE.MathUtils.clamp(
      handleFraction,
      0,
      1,
    );
    const handleAngle = maximumHandleAngle * resolvedHandleFraction;
    const gabLift = handleLiftAtAngle(handleAngle);
    const liftDerivativeByAngle = -camContactLocal.x * Math.cos(handleAngle)
      + camContactLocal.y * Math.sin(handleAngle);
    const liftSecondDerivativeByAngle = rotate2(
      handleAngle,
      camContactLocal,
    ).y;
    const gabLiftVelocity = liftDerivativeByAngle * handleAngularVelocity;
    const gabLiftAcceleration = liftSecondDerivativeByAngle
      * handleAngularVelocity ** 2
      + liftDerivativeByAngle * handleAcceleration;

    const nominalRockerAngle = valveRockerAmplitude
      * Math.sin(resolvedInputAngle);
    const nominalValvePin = pointInPose(
      valvePivot,
      nominalRockerAngle,
      valvePinLocal,
    );
    const clearNormalized = THREE.MathUtils.clamp(
      (gabLift - fullClearCouplingStart)
        / (fullClearCouplingEnd - fullClearCouplingStart),
      0,
      1,
    );
    const couplingBlend = 1 - smootherstepLaw(clearNormalized).value;
    const rockerAngle = nominalRockerAngle * couplingBlend;
    const valvePin = pointInPose(valvePivot, rockerAngle, valvePinLocal);
    const gabCenter = nominalValvePin.clone().add(
      new THREE.Vector2(0, gabLift),
    );
    const pinRelativeToGab = valvePin.clone().sub(gabCenter);

    const camPivot = gabCenter.clone().add(camPivotLocal);
    const camSupportCenter = pointInPose(
      valvePivot,
      rockerAngle,
      camSupportValveLocal,
    );
    const camSupportTangent = rotate2(
      rockerAngle,
      new THREE.Vector2(1, 0),
    );
    const camSupportNormal = new THREE.Vector2(
      -camSupportTangent.y,
      camSupportTangent.x,
    );
    const camAngle = camAngleOnShoulder(camPivot, camContactLocal,
      camSupportCenter, camSupportNormal, handleAngle);
    const camContactPoint = camPivot.clone().add(rotate2(camAngle, camContactLocal));
    const camSurfacePoint = camContactPoint.clone().addScaledVector(camSupportNormal, -camToeRadius);
    const contactFromSupportCenter = camContactPoint.clone().sub(
      camSupportCenter,
    );
    const camContactSignedNormalError = contactFromSupportCenter.dot(
      camSupportNormal,
    );
    const camSupportPoint = camContactPoint.clone().addScaledVector(
      camSupportNormal,
      -camContactSignedNormalError,
    );
    const camContactError = Math.abs(camContactSignedNormalError);

    const notchALocal = notchALocalAtHandleAngle(camAngle);
    const notchA = gabCenter.clone().add(notchALocal);
    const springHandlePointsLocal = springHandlePointsAtConfiguration({
      handleAngle: camAngle,
      handleFraction: resolvedHandleFraction,
      springDeflection,
    });
    const springLatchTipLocal = springHandlePointsLocal.at(-1);
    const springLatchTip = gabCenter.clone().add(
      new THREE.Vector2(springLatchTipLocal.x, springLatchTipLocal.y),
    );
    const latchPlanarGap = springLatchTip.distanceTo(notchA);
    const latchGap = Math.hypot(latchPlanarGap, springDeflection);
    const latchCaptureError = latchEngagement >= 1 - 1e-12
      ? latchGap
      : 0;

    const jawMinimumY = -gabMouthDepth;
    const jawMaximumY = gabTopBridgeMaximumY;
    const leftJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(
        -gabInnerHalfWidth - gabJawWidth,
        jawMinimumY,
      ),
      new THREE.Vector2(-gabInnerHalfWidth, jawMaximumY),
    ) - gabPinRadius;
    const rightJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(gabInnerHalfWidth, jawMinimumY),
      new THREE.Vector2(
        gabInnerHalfWidth + gabJawWidth,
        jawMaximumY,
      ),
    ) - gabPinRadius;
    const topBridgeClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(
        -gabInnerHalfWidth,
        gabTopBridgeMinimumY,
      ),
      new THREE.Vector2(
        gabInnerHalfWidth,
        gabTopBridgeMaximumY,
      ),
    ) - gabPinRadius;
    const minimumGabSolidClearance = Math.min(
      leftJawClearance,
      rightJawClearance,
      topBridgeClearance,
    );
    const pinInsideGabMouth = (
      Math.abs(pinRelativeToGab.x) + gabPinRadius
        <= gabInnerHalfWidth + 1e-10
        && pinRelativeToGab.y - gabPinRadius
          >= -gabMouthDepth - 1e-10
        && pinRelativeToGab.y + gabPinRadius
          <= gabTopBridgeMinimumY + 1e-10
    );
    const pinFullyClearBelowGab = pinRelativeToGab.y + gabPinRadius
      < -gabMouthDepth;
    const gabCaptured = gabLift <= 1e-12
      && couplingBlend >= 1 - 1e-12
      && valvePin.distanceTo(gabCenter) <= 1e-12;

    return {
      camAngle, camSurfacePoint,
      camRockingCorrection: camAngle - handleAngle,
      camContactError,
      camContactPoint,
      camContactSignedNormalError,
      camPivot,
      camSupportCenter,
      camSupportNormal,
      camSupportPoint,
      couplingBlend,
      gabCaptured,
      gabCenter,
      gabLift,
      gabLiftAcceleration,
      gabLiftVelocity,
      handleAcceleration,
      handleAngle,
      handleAngularVelocity,
      handleFraction: resolvedHandleFraction,
      inputAngle: resolvedInputAngle,
      latchCaptureError,
      latchEngagement: THREE.MathUtils.clamp(latchEngagement, 0, 1),
      latchGap,
      latchPlanarGap,
      minimumGabSolidClearance,
      nominalRockerAngle,
      nominalValvePin,
      notchA,
      pinFullyClearBelowGab,
      pinInsideGabMouth,
      pinRelativeToGab,
      rockerAngle,
      springDeflection,
      springHandlePointsLocal,
      springLatchTip,
      springLatchTipLocal: springLatchTipLocal.clone(),
      valvePin,
      valvePinRadiusError: Math.abs(
        valvePin.distanceTo(valvePivot) - valveArmLength
      ),
      valvePivot: valvePivot.clone(),
    };
  };

  const stateAtInputAngle = (inputAngle, handleFraction = 0) => (
    stateAtConfiguration({ handleFraction, inputAngle })
  );
  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const input = inputMotionAtCyclePhase(sequence.phase);
    const phaseRate = 1 / cyclePeriod;
    const handleAngularVelocity = maximumHandleAngle
      * sequence.handleRatePerPhase
      * phaseRate;
    const handleAcceleration = maximumHandleAngle
      * sequence.handleAccelerationPerPhaseSquared
      * phaseRate ** 2;
    const state = stateAtConfiguration({
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: sequence.handleFraction,
      inputAngle: input.angle,
      latchEngagement: sequence.latchEngagement,
      springDeflection: sequence.springDeflection,
    });
    state.cyclePhase = sequence.phase;
    state.inputAngularAcceleration = input.accelerationPerPhaseSquared
      * phaseRate ** 2;
    state.inputAngularSpeed = input.ratePerPhase * phaseRate;
    state.inputTurns = input.turns;
    state.latchAcceleration = sequence.latchAccelerationPerPhaseSquared
      * phaseRate ** 2;
    state.latchRate = sequence.latchRatePerPhase * phaseRate;
    state.springDeflectionRate = sequence.springDeflectionRatePerPhase
      * phaseRate;
    state.stage = sequence.stage;
    state.camContactActive = true;
    state.camLiftActive = (
      sequence.stage === 'pulling-spring-handle-cam-lifting-gab'
        || sequence.stage === 'spring-handle-passing-notch-a'
        || sequence.stage === 'cam-lowering-gab-around-valve-pin'
    );
    return state;
  };
  const stateAtTime = (time) => {
    const state = stateAtCyclePhase(time / cyclePeriod);
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  // Source-traced visible bodies. Pixel outlines are measured on Brown's
  // 525-pixel plate and share the model's 0.015-unit pixel scale.
  const rodFromRaster = (point) => sourcePointFromRaster(point);
  const camFromRaster = (point) => sourcePointFromRaster(point).sub(camPivotLocal);
  const valveRocker = new THREE.Group();
  valveRocker.position.set(valvePivot.x, valvePivot.y, -.48);
  valveRocker.userData.axis = Z_AXIS.clone();
  valveRocker.userData.role =
    'fixed-axis-valve-gab-lever-carrying-the-engagement-pin';
  const valveShaft = cylinderAlongZ(0.45, 1.66, darkMaterial, 48);
  valveShaft.userData.role = 'fixed-valve-rockshaft';
  const valveShaftFace = boredBoss(0.78, 0.22, 0.462, drivenMaterial);
  valveShaftFace.position.z = 0.28;
  valveShaftFace.userData.role = 'source-round-valve-rockshaft-boss';
  // The tapered lever ends in the round boss seen below the rod.
  const valveArm = boredGabLever(valvePinLocal, {
    startRadius: 0.78, endRadius: 0.795, startBore: 0.462,
    endBore: gabPinRadius + .012, depth: 0.32, width: 1.08,
  }, drivenMaterial);
  valveArm.userData.role = 'rigid-valve-lever-from-rockshaft-to-gab-pin';
  const valvePin = cylinderAlongZ(gabPinRadius, 1.04, brassMaterial, 40);
  valvePin.position.set(valvePinLocal.x, valvePinLocal.y, 0.36);
  valvePin.userData.role = 'valve-gear-pin-captured-by-eccentric-rod-gab';
  const valvePinIndex = new THREE.Group();
  valvePinIndex.position.set(valvePinLocal.x, valvePinLocal.y, 0.88);
  valvePinIndex.userData.role = 'valve-gear-pin-face-anchor';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.position.set(valvePinLocal.x, valvePinLocal.y, 0);
  valvePinAnchor.userData.role = 'exact-valve-pin-center-anchor';
  const valveShaftIndex = new THREE.Group();
  valveShaftIndex.userData.role = 'valve-rockshaft-angle-anchor';
  // Hidden shoulder behind the cam hook (the plate's dashed lobe); it is
  // only as long as the toe's sampled travel requires.
  const camSupportShoe = makeBeam(
    new THREE.Vector3(
      camSupportValveLocal.x - camSupportRearReach,
      camSupportValveLocal.y,
      .23,
    ),
    new THREE.Vector3(
      camSupportValveLocal.x + camSupportFrontReach,
      camSupportValveLocal.y,
      .23,
    ),
    {
      color: PALETTE.driven,
      depth: 0.14,
      jointRadius: 0.001,
      thickness: 0.16,
    },
  );
  camSupportShoe.position.y -= camToeRadius + .08;
  camSupportShoe.userData.role =
    'valve-lever-shoulder-on-which-the-lifting-cam-slides';
  const camSupportAnchor = new THREE.Group();
  camSupportAnchor.position.set(
    camSupportValveLocal.x,
    camSupportValveLocal.y,
    .23,
  );
  camSupportAnchor.userData.role = 'source-center-of-cam-support-shoulder';
  valveRocker.add(
    camSupportAnchor,
    camSupportShoe,
    valveShaft,
    valveShaftFace,
    valveArm,
    valvePin,
    valvePinIndex,
    valvePinAnchor,
    valveShaftIndex,
  );
  root.add(valveRocker);

  const eccentricRod = new THREE.Group();
  eccentricRod.position.z = 0.18;
  eccentricRod.userData.role =
    'reciprocating-eccentric-rod-with-downward-opening-gab';
  // One plate: the broken-off rod bar (y 230-268), its round crown about
  // the gab, and the gab slot cut up from the bar's lower edge.
  const rodBarBottom = -gabMouthDepth;
  const rodBody = sourcePlate([
    [[18, 230], [383, 230], [383, 268], [18, 268]],
    polygonClipping.intersection(
      poly(circle([0, 0], rodCrownRadius, 128)),
      poly([[-1, rodBarBottom], [1, rodBarBottom], [1, 1], [-1, 1]]),
    ),
  ], rodFromRaster, -0.17, 0.17, driverMaterial, [
    poly([[-gabInnerHalfWidth, rodBarBottom - .1], [gabInnerHalfWidth, rodBarBottom - .1],
      [gabInnerHalfWidth, gabTopBridgeMinimumY], [-gabInnerHalfWidth, gabTopBridgeMinimumY]]),
  ]);
  rodBody.userData.role = 'eccentric-rod-with-round-crown-and-gab-slot';
  const rodLeftBody = rodBody;
  const rodRightBody = rodBody;
  const gabTopBridge = rodBody;
  const gabJaws = [-1, 1].map((sign) => {
    const jaw = new THREE.Group();
    jaw.position.set(sign * (gabInnerHalfWidth + gabJawWidth / 2), 0, 0);
    jaw.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-jaw-of-rod-bar`;
    eccentricRod.add(jaw);
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((sign) => {
    const shoe = new THREE.Group();
    shoe.position.set(sign * gabInnerHalfWidth, 0, 0);
    shoe.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-slot-face`;
    eccentricRod.add(shoe);
    return shoe;
  });
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.userData.role = 'exact-center-of-eccentric-rod-gab';
  const offFrameRodIndex = new THREE.Group();
  offFrameRodIndex.userData.role = 'eccentric-rod-stroke-anchor';
  eccentricRod.add(rodBody, gabCenterAnchor, offFrameRodIndex);
  root.add(eccentricRod);

  const camLever = new THREE.Group();
  camLever.position.set(camPivotLocal.x, camPivotLocal.y, 0.43);
  camLever.userData.axis = Z_AXIS.clone();
  camLever.userData.role =
    'upper-cam-lever-pivoted-independently-on-the-eccentric-rod';
  // Traced hook, pivot lobe, arm and forked head of the upper lever.
  const camLeverBody = sourcePlate([[
    [263, 152], [270, 146], [284, 145], [300, 150], [318, 160], [335, 177],
    [349, 198], [358, 218], [364, 237], [380, 246], [400, 251], [418, 251],
    [435, 246], [452, 238], [465, 229], [471, 219], [470, 206], [466, 199],
    [476, 193], [492, 200], [505, 208], [502, 226], [494, 233], [482, 243],
    [467, 253], [447, 261], [425, 266], [400, 267], [378, 264], [362, 258],
    [345, 257], [330, 255], [322, 247], [317, 235], [316, 222], [313, 205],
    [305, 187], [293, 170], [279, 159],
  ]], camFromRaster, -0.15, 0.03, accentMaterial, [
    poly(circle([0, 0], .127, 48)),
  ], true);
  camLeverBody.userData.role = 'curved-cam-and-upper-pull-handle';
  // The pivot pin passes through the rod to a rear cheek, the plate's
  // dashed lobe, which carries the round toe onto the valve-lever shoulder
  // entirely behind the rod and its crown.
  const camPivotPin = cylinderAlongZ(0.115, 0.82, darkMaterial, 28);
  camPivotPin.position.set(camPivotLocal.x, camPivotLocal.y, 0.09);
  camPivotPin.userData.role = 'cam-lever-pivot-fixed-in-eccentric-rod';
  const camContactNose = cylinderAlongZ(camToeRadius, .16, accentMaterial, 128);
  camContactNose.position.set(camContactLocal.x, camContactLocal.y, -.81);
  const camToeNeck = new THREE.Mesh(plate(polygonClipping.difference(polygonClipping.union(
    capsule([0, 0], [camContactLocal.x, camContactLocal.y], .10, 32),
    poly(circle([0, 0], .20, 48)),
  ), poly(circle([0, 0], .127, 48))), -.73, -.63), accentMaterial);
  camToeNeck.userData.role = 'rear-cheek-carrying-hidden-cam-toe';
  camLever.add(camToeNeck);
  camContactNose.userData.role = 'finite-round-cam-toe-bearing-on-valve-gear-shoulder';
  const upperHandleGrip = cylinderAlongZ(0.15, 0.39, accentMaterial, 28);
  upperHandleGrip.position.set(handleGripLocal.x, handleGripLocal.y, 0.045);
  upperHandleGrip.userData.role = 'source-upper-handle-grip';
  // The tang hangs from the forked head. Notch a is a square mouth cut
  // toward the upper left, so that at the latched lever angle it faces the
  // arriving spring tip.
  const notchAxis = new THREE.Vector2(Math.cos(2.13), Math.sin(2.13));
  const notchNormal = new THREE.Vector2(-notchAxis.y, notchAxis.x);
  const notchCorner = (along, across) => {
    const point = camNotchALocal.clone().addScaledVector(notchAxis, along).addScaledVector(notchNormal, across);
    return [point.x, point.y];
  };
  const camLatchTang = sourcePlate([[
    [476, 222], [497, 222], [501, 250], [502, 280], [501, 305], [499, 334],
    [488, 339], [476, 334], [473, 315], [474, 300], [477, 275], [477, 250],
  ]], camFromRaster, 0.14, 0.24, accentMaterial, [poly([
    notchCorner(-.14, -.12), notchCorner(.8, -.12), notchCorner(.8, .12), notchCorner(-.14, .12),
  ])]);
  camLatchTang.userData.role =
    'cam-lever-spring-catch-tang-containing-notch-a';
  const notchLipUpper = new THREE.Group();
  notchLipUpper.position.set(camNotchALocal.x, camNotchALocal.y + .09, 0.19);
  notchLipUpper.userData.role = 'upper-working-lip-of-notch-a';
  const notchLipLower = new THREE.Group();
  notchLipLower.position.set(camNotchALocal.x, camNotchALocal.y - .09, 0.19);
  notchLipLower.userData.role = 'lower-working-lip-of-notch-a';
  const notchAAnchor = new THREE.Group();
  notchAAnchor.position.set(camNotchALocal.x, camNotchALocal.y, 0.19);
  notchAAnchor.userData.role = 'exact-moving-center-of-notch-a';
  camLever.add(
    camLeverBody,
    camContactNose,
    camLatchTang,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    upperHandleGrip,
  );
  eccentricRod.add(camLever, camPivotPin);

  const springHandle = new THREE.Group();
  const springStrap = makeFlatStrap(springStrapPoints, 0.13, 0.10, brassMaterial);
  springStrap.userData.role = 'flat-loop-spring-strap';
  springHandle.add(springStrap);
  springHandle.userData.role =
    'separate-rod-mounted-flexible-loop-spring-handle-pulled-up-to-notch-a';
  const springHandleAnchor = cylinderAlongZ(
    0.09,
    0.57,
    darkMaterial,
    28,
  );
  springHandleAnchor.position.set(
    springHandleAnchorLocal.x,
    springHandleAnchorLocal.y,
    0.385,
  );
  springHandleAnchor.userData.role =
    'fixed-root-of-spring-handle-in-eccentric-rod';
  const springTipIndex = new THREE.Group();
  springTipIndex.position.set(
    springRestTipLocal.x,
    springRestTipLocal.y,
    0.62,
  );
  springTipIndex.userData.role = 'spring-latch-tip-anchor';
  eccentricRod.add(springHandle, springHandleAnchor, springTipIndex);

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-frame-supporting-valve-rockshaft';
  const frameBeams = [];
  const valveBearing = new THREE.Group();
  valveBearing.userData.role = 'rear-valve-rockshaft-bearing';
  frame.add(valveBearing);
  root.add(frame);

  // State markers are anchors only: the plate draws no contact dots.
  const camContactMarker = new THREE.Group();
  camContactMarker.userData.role = 'cam-lifting-contact-anchor';
  const gabCaptureMarker = new THREE.Group();
  gabCaptureMarker.userData.role = 'gab-pin-capture-anchor';
  const latchMarker = new THREE.Group();
  latchMarker.userData.role = 'spring-handle-notch-a-capture-anchor';
  root.add(camContactMarker, gabCaptureMarker, latchMarker);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 8.2, 3.0),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.05, 0.15, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    cameraEnvelope,
    camContactMarker,
    camContactNose,
    camToeNeck,
    camSupportAnchor,
    camSupportShoe,
    camLatchTang,
    camLever,
    camLeverBody,
    camPivotPin,
    eccentricRod,
    frame,
    frameBeams,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabJaws,
    gabTopBridge,
    latchMarker,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    offFrameRodIndex,
    rodBody,
    rodLeftBody,
    rodRightBody,
    springHandle,
    springStrap,
    springHandleAnchor,
    springTipIndex,
    upperHandleGrip,
    valveArm,
    valveBearing,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveRocker,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  };

  const geometry = {
    camToeRadius,
    camContactLocal: camContactLocal.clone(),
    camSupportHalfLength,
    camContactSourceHeight,
    camSupportValveLocal: camSupportValveLocal.clone(),
    camNotchALocal: camNotchALocal.clone(),
    camPivotLocal: camPivotLocal.clone(),
    cyclePeriod,
    fullClearCouplingEnd,
    fullClearCouplingStart,
    gabInnerHalfWidth,
    gabJawWidth,
    gabMouthDepth,
    gabPinRadius,
    gabTopBridgeMaximumY,
    gabTopBridgeMinimumY,
    handleGripLocal: handleGripLocal.clone(),
    inputTurnsPerCycle,
    maximumGabLift,
    maximumHandleAngle,
    sequenceBreaks,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCamContact: sourceRasterCamContact.clone(),
    sourceRasterCamPivot: sourceRasterCamPivot.clone(),
    sourceRasterGabPin: sourceRasterGabPin.clone(),
    sourceRasterHandleGrip: sourceRasterHandleGrip.clone(),
    sourceRasterNotchA: sourceRasterNotchA.clone(),
    sourceRasterSpringAnchor: sourceRasterSpringAnchor.clone(),
    sourceRasterSpringBottom: sourceRasterSpringBottom.clone(),
    sourceRasterSpringFreeTip: sourceRasterSpringFreeTip.clone(),
    sourceRasterValvePivot: sourceRasterValvePivot.clone(),
    sourceUnitsPerPixel,
    springHandleAnchorLocal: springHandleAnchorLocal.clone(),
    springMaximumDeflection,
    springRestPathLocal: springRestPathLocal.map((point) => point.clone()),
    springRestTipLocal: springRestTipLocal.clone(),
    valveArmLength,
    valvePinLocal: valvePinLocal.clone(),
    valvePivot: valvePivot.clone(),
    valveRockerAmplitude,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveRocker.rotation.z = state.rockerAngle;
    eccentricRod.position.set(
      state.gabCenter.x,
      state.gabCenter.y,
      0.18,
    );
    camLever.rotation.z = state.camAngle;
    const springCurve = new THREE.CatmullRomCurve3(
      state.springHandlePointsLocal,
      false,
      'centripetal',
    );
    springStrap.userData.setPoints(springCurve.getSpacedPoints(springStrapPoints - 1));
    springTipIndex.position.copy(state.springLatchTipLocal);
    camContactMarker.position.set(
      state.camSurfacePoint.x,
      state.camSurfacePoint.y,
      0.61,
    );
    camContactMarker.visible = state.camLiftActive;
    gabCaptureMarker.position.set(
      state.valvePin.x,
      state.valvePin.y,
      1.12,
    );
    gabCaptureMarker.visible = state.gabCaptured;
    latchMarker.position.set(state.notchA.x, state.notchA.y, 0.80);
    latchMarker.visible = state.latchEngagement > 1 - 1e-8;
    root.userData.contacts = {
      camShoulder: {
        active: state.camContactActive,
        contactError: state.camContactError,
        point: state.camSurfacePoint.clone(),
        toeCenter: state.camContactPoint.clone(),
      },
      gabPin: {
        captured: state.gabCaptured,
        clearance: state.minimumGabSolidClearance,
        gabCenter: state.gabCenter.clone(),
        pin: state.valvePin.clone(),
      },
      notchA: {
        captureError: state.latchCaptureError,
        engagement: state.latchEngagement,
        gap: state.latchGap,
        point: state.notchA.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    engagedRunning: 0,
    handleHalfRaised: cyclePeriod * 0.25,
    latchedDisengaged: cyclePeriod * 0.45,
    springFlexedForRelease: cyclePeriod * 0.61,
    handleHalfLowered: cyclePeriod * 0.72,
    nextEngagedRunning: cyclePeriod,
  };
  const canonicalStates = {
    engagedAtQuarterTurn: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: Math.PI / 2,
    }),
    fullyLiftedAtQuarterTurn: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: Math.PI / 2,
      latchEngagement: 1,
    }),
    sourceEngaged: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 0,
    }),
  };

  root.userData.archetype =
    'spring-handle-cam-lifted-eccentric-rod-gab-pin-notch-latch';
  root.userData.blocks = blocks;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.handleLiftAtAngle = handleLiftAtAngle;
  root.userData.inputMotionAtCyclePhase = inputMotionAtCyclePhase;
  root.userData.mechanism =
    'rod-carried-cam-lever-lifts-downward-opening-eccentric-rod-gab-off-valve-pin-and-spring-handle-latches-in-notch-a';
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.springHandlePointsAtConfiguration =
    springHandlePointsAtConfiguration;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.sourceRasterFromPoint = sourceRasterFromPoint;
  root.userData.stateAtConfiguration = stateAtConfiguration;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.02;
  root.userData.fidelity = 'authored';

  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    camContactMarker,
    gabCaptureMarker,
    latchMarker,
    offFrameRodIndex,
    springTipIndex,
    valvePinIndex,
    valveShaftIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(4.6, 3.4, 14.8),
    root,
    update,
  };
}

function twoHandleGabDisengager() {
  const root = new THREE.Group();

  // Brown's 187 side elevation is measured from the gab-pin center. Unlike
  // 186, the lower handle is one rigid piece with the eccentric rod and the
  // upper handle alone pivots. Its rear cam toe bears on the top surface
  // of the valve-lever shoulder: raising that handle makes the toe descend about
  // its rod-mounted pivot, so the reaction lifts the rod and its open gab.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterGabPin = new THREE.Vector2(313, 238);
  const sourceRasterValvePivot = new THREE.Vector2(313, 111);
  const sourceRasterCamPivot = new THREE.Vector2(320, 198);
  const sourceRasterCamContact = new THREE.Vector2(276, 179);
  const sourceRasterUpperGrip = new THREE.Vector2(474, 195);
  const sourceRasterLowerGrip = new THREE.Vector2(474, 245);
  const sourceRasterRodLeftEnd = new THREE.Vector2(15, 242);
  const sourceRasterSupportLeft = new THREE.Vector2(258, 179);
  const sourceRasterSupportRight = new THREE.Vector2(370, 179);
  const sourceUnitsPerPixel = 0.018;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterGabPin.x) * sourceUnitsPerPixel,
    (sourceRasterGabPin.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceRasterFromPoint = (point) => new THREE.Vector2(
    sourceRasterGabPin.x + point.x / sourceUnitsPerPixel,
    sourceRasterGabPin.y - point.y / sourceUnitsPerPixel,
  );

  const valvePivot = sourcePointFromRaster(sourceRasterValvePivot);
  const valvePinLocal = valvePivot.clone().multiplyScalar(-1);
  const valveArmLength = valvePinLocal.length();
  const camPivotLocal = sourcePointFromRaster(sourceRasterCamPivot);
  const sourceCamContact = sourcePointFromRaster(sourceRasterCamContact);
  const camContactLocal = sourceCamContact.clone().sub(camPivotLocal);
  const upperGripLocal = sourcePointFromRaster(sourceRasterUpperGrip)
    .sub(camPivotLocal);
  const lowerGripLocal = sourcePointFromRaster(sourceRasterLowerGrip);
  const rodLeftEndLocal = sourcePointFromRaster(sourceRasterRodLeftEnd);
  const supportLeftLocal = sourcePointFromRaster(sourceRasterSupportLeft)
    .sub(valvePivot);
  const supportRightLocal = sourcePointFromRaster(sourceRasterSupportRight)
    .sub(valvePivot);
  const camSupportValveLocal = supportLeftLocal.clone()
    .add(supportRightLocal)
    .multiplyScalar(0.5);
  const camSupportHalfLength = supportLeftLocal.distanceTo(supportRightLocal)
    / 2;

  const rodStroke = 0.30;
  const maximumHandleAngle = 0.92;
  const camToeRadius = .12;
  // Plate: a 16.5-pixel pin in a slot cut up from the rod's lower edge,
  // 21.5 pixels below the pin center, into a 55-pixel round crown.
  const gabPinRadius = 0.25;
  const gabInnerHalfWidth = gabPinRadius + 0.05;
  const gabJawWidth = 0.5;
  const gabMouthDepth = 0.387;
  // The rocking pin rises up to 0.02 in the level rod's slot.
  const gabTopBridgeMinimumY = 0.33;
  const gabTopBridgeMaximumY = 0.99;
  const rodCrownRadius = 0.99;
  const fullClearCouplingStart = gabMouthDepth + gabPinRadius + 0.03;
  const fullClearCouplingEnd = gabMouthDepth + gabPinRadius + 0.07;

  const handleLiftAtAngle = (handleAngle) => camContactLocal.y
    - rotate2(handleAngle, camContactLocal).y;
  const maximumGabLift = handleLiftAtAngle(maximumHandleAngle);
  if (maximumGabLift <= fullClearCouplingEnd) {
    throw new RangeError('Movement 187 cam cannot lift the gab clear of its pin.');
  }

  const cyclePeriod = 16;
  const inputTurnsPerCycle = 6;
  const sequenceBreaks = Object.freeze({
    engagedRunEnd: 0.20,
    handleRaiseStart: 0.24,
    handleRaiseEnd: 0.40,
    releasedRunEnd: 0.66,
    handleLowerStart: 0.70,
    handleLowerEnd: 0.84,
  });

  const inputMotionAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let turns = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 2,
    };
    if (phase < sequenceBreaks.engagedRunEnd) {
      turns = transitionLaw(
        phase,
        0,
        sequenceBreaks.engagedRunEnd,
        0,
        2,
      );
    } else if (phase < sequenceBreaks.handleRaiseEnd) {
      turns.value = 2;
    } else if (phase < sequenceBreaks.releasedRunEnd) {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleRaiseEnd,
        sequenceBreaks.releasedRunEnd,
        2,
        4,
      );
    } else if (phase < sequenceBreaks.handleLowerEnd) {
      turns.value = 4;
    } else {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLowerEnd,
        1,
        4,
        inputTurnsPerCycle,
      );
    }
    return {
      accelerationPerPhaseSquared:
        FULL_TURN * turns.accelerationPerPhaseSquared,
      angle: FULL_TURN * turns.value,
      phase,
      ratePerPhase: FULL_TURN * turns.ratePerPhase,
      turns: turns.value,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let handle = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.handleRaiseStart
        && phase < sequenceBreaks.handleRaiseEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleRaiseStart,
        sequenceBreaks.handleRaiseEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handleRaiseEnd
        && phase < sequenceBreaks.handleLowerStart
    ) {
      handle.value = 1;
    } else if (
      phase >= sequenceBreaks.handleLowerStart
        && phase < sequenceBreaks.handleLowerEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleLowerStart,
        sequenceBreaks.handleLowerEnd,
        1,
        0,
      );
    }

    let stage = 'engaged-eccentric-rod-driving-valve-gear';
    if (
      phase >= sequenceBreaks.engagedRunEnd
        && phase < sequenceBreaks.handleRaiseStart
    ) stage = 'eccentric-stopped-with-gab-pin-aligned';
    else if (
      phase >= sequenceBreaks.handleRaiseStart
        && phase < sequenceBreaks.handleRaiseEnd
    ) stage = 'raising-upper-cam-handle-lifting-gab';
    else if (
      phase >= sequenceBreaks.handleRaiseEnd
        && phase < sequenceBreaks.releasedRunEnd
    ) stage = 'operator-holding-two-handle-gab-clear-while-rod-runs';
    else if (
      phase >= sequenceBreaks.releasedRunEnd
        && phase < sequenceBreaks.handleLowerStart
    ) stage = 'eccentric-stopped-with-gab-held-clear';
    else if (
      phase >= sequenceBreaks.handleLowerStart
        && phase < sequenceBreaks.handleLowerEnd
    ) stage = 'lowering-upper-cam-handle-recapturing-pin';
    else if (phase >= sequenceBreaks.handleLowerEnd) {
      stage = 'gab-recaptured-eccentric-rod-driving-valve-gear';
    }

    return {
      handleAccelerationPerPhaseSquared:
        handle.accelerationPerPhaseSquared,
      handleFraction: handle.value,
      handleRatePerPhase: handle.ratePerPhase,
      phase,
      stage,
    };
  };

  const nominalRockerAngleAtInput = (inputAngle) => Math.asin(
    THREE.MathUtils.clamp(
      rodStroke * Math.sin(inputAngle) / valveArmLength,
      -1,
      1,
    ),
  );

  const stateAtConfiguration = ({
    handleAcceleration = 0,
    handleAngularVelocity = 0,
    handleFraction = 0,
    inputAngle = 0,
  }) => {
    const resolvedInputAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const resolvedHandleFraction = THREE.MathUtils.clamp(
      handleFraction,
      0,
      1,
    );
    const handleAngle = maximumHandleAngle * resolvedHandleFraction;
    const gabLift = handleLiftAtAngle(handleAngle);
    const liftDerivativeByAngle = -camContactLocal.x * Math.cos(handleAngle)
      + camContactLocal.y * Math.sin(handleAngle);
    const liftSecondDerivativeByAngle = rotate2(
      handleAngle,
      camContactLocal,
    ).y;
    const gabLiftVelocity = liftDerivativeByAngle * handleAngularVelocity;
    const gabLiftAcceleration = liftSecondDerivativeByAngle
      * handleAngularVelocity ** 2
      + liftDerivativeByAngle * handleAcceleration;

    const gabCenter = new THREE.Vector2(
      rodStroke * Math.sin(resolvedInputAngle),
      gabLift,
    );
    const nominalRockerAngle = nominalRockerAngleAtInput(resolvedInputAngle);
    const clearNormalized = THREE.MathUtils.clamp(
      (gabLift - fullClearCouplingStart)
        / (fullClearCouplingEnd - fullClearCouplingStart),
      0,
      1,
    );
    const couplingBlend = 1 - smootherstepLaw(clearNormalized).value;
    const rockerAngle = nominalRockerAngle * couplingBlend;
    const valvePin = pointInPose(valvePivot, rockerAngle, valvePinLocal);
    const pinRelativeToGab = valvePin.clone().sub(gabCenter);

    const camPivot = gabCenter.clone().add(camPivotLocal);
    const lowerGrip = gabCenter.clone().add(lowerGripLocal);
    const camSupportCenter = pointInPose(
      valvePivot,
      rockerAngle,
      camSupportValveLocal,
    );
    const camSupportTangent = rotate2(
      rockerAngle,
      new THREE.Vector2(1, 0),
    );
    const camSupportNormal = new THREE.Vector2(
      -camSupportTangent.y,
      camSupportTangent.x,
    );
    const camAngle = camAngleOnShoulder(camPivot, camContactLocal,
      camSupportCenter, camSupportNormal, handleAngle);
    const camContactPoint = camPivot.clone().add(rotate2(camAngle, camContactLocal));
    const camSurfacePoint = camContactPoint.clone().addScaledVector(camSupportNormal, -camToeRadius);
    const contactFromSupportCenter = camContactPoint.clone().sub(
      camSupportCenter,
    );
    const camContactAlongSupport = contactFromSupportCenter.dot(
      camSupportTangent,
    );
    const camContactSignedNormalError = contactFromSupportCenter.dot(
      camSupportNormal,
    );
    const camSupportPoint = camContactPoint.clone().addScaledVector(
      camSupportNormal,
      -camContactSignedNormalError,
    );
    const camContactError = Math.abs(camContactSignedNormalError);
    const camContactWithinSupport = Math.abs(camContactAlongSupport)
      <= camSupportHalfLength + 1e-10;

    const jawMinimumY = -gabMouthDepth;
    const jawMaximumY = gabTopBridgeMaximumY;
    const leftJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(-gabInnerHalfWidth - gabJawWidth, jawMinimumY),
      new THREE.Vector2(-gabInnerHalfWidth, jawMaximumY),
    ) - gabPinRadius;
    const rightJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(gabInnerHalfWidth, jawMinimumY),
      new THREE.Vector2(
        gabInnerHalfWidth + gabJawWidth,
        jawMaximumY,
      ),
    ) - gabPinRadius;
    const topBridgeClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(-gabInnerHalfWidth, gabTopBridgeMinimumY),
      new THREE.Vector2(gabInnerHalfWidth, gabTopBridgeMaximumY),
    ) - gabPinRadius;
    const minimumGabSolidClearance = Math.min(
      leftJawClearance,
      rightJawClearance,
      topBridgeClearance,
    );
    const pinInsideGabMouth = (
      Math.abs(pinRelativeToGab.x) + gabPinRadius
        <= gabInnerHalfWidth + 1e-10
        && pinRelativeToGab.y - gabPinRadius
          >= -gabMouthDepth - 1e-10
        && pinRelativeToGab.y + gabPinRadius
          <= gabTopBridgeMinimumY + 1e-10
    );
    const pinFullyClearBelowGab = pinRelativeToGab.y + gabPinRadius
      < -gabMouthDepth;
    const gabCaptured = gabLift <= 1e-12
      && couplingBlend >= 1 - 1e-12
      && pinInsideGabMouth;

    const upperGrip = camPivot.clone().add(rotate2(camAngle, upperGripLocal));
    return {
      camAngle, camSurfacePoint,
      camRockingCorrection: camAngle - handleAngle,
      camContactAlongSupport,
      camContactError,
      camContactPoint,
      camContactSignedNormalError,
      camContactWithinSupport,
      camPivot,
      camSupportCenter,
      camSupportNormal,
      camSupportPoint,
      camSupportTangent,
      couplingBlend,
      gabCaptured,
      gabCenter,
      gabLift,
      gabLiftAcceleration,
      gabLiftVelocity,
      handleAcceleration,
      handleAngle,
      handleAngularVelocity,
      handleFraction: resolvedHandleFraction,
      inputAngle: resolvedInputAngle,
      lateralDriveError: Math.abs(pinRelativeToGab.x),
      leftJawClearance,
      lowerGrip,
      minimumGabSolidClearance,
      nominalRockerAngle,
      pinFullyClearBelowGab,
      pinInsideGabMouth,
      pinRelativeToGab,
      rightJawClearance,
      rockerAngle,
      topBridgeClearance,
      upperGrip,
      valvePin,
      valvePinRadiusError: Math.abs(
        valvePin.distanceTo(valvePivot) - valveArmLength
      ),
      valvePivot: valvePivot.clone(),
    };
  };

  const stateAtInputAngle = (inputAngle, handleFraction = 0) => (
    stateAtConfiguration({ handleFraction, inputAngle })
  );
  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const input = inputMotionAtCyclePhase(sequence.phase);
    const phaseRate = 1 / cyclePeriod;
    const handleAngularVelocity = maximumHandleAngle
      * sequence.handleRatePerPhase
      * phaseRate;
    const handleAcceleration = maximumHandleAngle
      * sequence.handleAccelerationPerPhaseSquared
      * phaseRate ** 2;
    const state = stateAtConfiguration({
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: sequence.handleFraction,
      inputAngle: input.angle,
    });
    state.cyclePhase = sequence.phase;
    state.inputAngularAcceleration = input.accelerationPerPhaseSquared
      * phaseRate ** 2;
    state.inputAngularSpeed = input.ratePerPhase * phaseRate;
    state.inputTurns = input.turns;
    state.stage = sequence.stage;
    state.camContactActive = true;
    state.camLiftActive = (
      sequence.stage === 'raising-upper-cam-handle-lifting-gab'
        || sequence.stage
          === 'operator-holding-two-handle-gab-clear-while-rod-runs'
        || sequence.stage === 'eccentric-stopped-with-gab-held-clear'
        || sequence.stage === 'lowering-upper-cam-handle-recapturing-pin'
    );
    state.operatorHoldingHandle = (
      sequence.stage
        === 'operator-holding-two-handle-gab-clear-while-rod-runs'
        || sequence.stage === 'eccentric-stopped-with-gab-held-clear'
    );
    return state;
  };
  const stateAtTime = (time) => {
    const state = stateAtCyclePhase(time / cyclePeriod);
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.19,
    roughness: 0.51,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  // Source-traced visible bodies (Brown's 525-pixel plate, 0.018 units per
  // pixel). Front to back: the rod with its round crown and integral lower
  // handle; the upper handle pivoted behind the crown; the valve lever.
  const rodFromRaster = (point) => sourcePointFromRaster(point);
  const camFromRaster = (point) => sourcePointFromRaster(point).sub(camPivotLocal);
  const valveRocker = new THREE.Group();
  valveRocker.position.set(valvePivot.x, valvePivot.y, -.54);
  valveRocker.userData.axis = Z_AXIS.clone();
  valveRocker.userData.role =
    'top-pivoted-valve-lever-carrying-the-gab-pin-and-cam-support';
  // The shaft and its boss end behind the upper handle's plane, which
  // swings past them when raised.
  const valveShaft = cylinderAlongZ(0.32, 1.17, darkMaterial, 40);
  valveShaft.position.z = -0.275;
  valveShaft.userData.role = 'fixed-valve-rockshaft';
  const valveShaftFace = boredBoss(0.63, 0.14, 0.332, drivenMaterial);
  valveShaftFace.position.z = 0.24;
  valveShaftFace.userData.role = 'source-round-valve-rockshaft-boss';
  const valveArm = boredGabLever(valvePinLocal, {
    startRadius: 0.63, endRadius: 0.85,
    startBore: 0.332, endBore: gabPinRadius + .012, depth: 0.34, width: 0.76,
  }, drivenMaterial);
  valveArm.userData.role = 'rigid-valve-lever-from-rockshaft-to-gab-pin';
  const valvePin = cylinderAlongZ(gabPinRadius, 1.09, brassMaterial, 40);
  valvePin.position.set(valvePinLocal.x, valvePinLocal.y, 0.375);
  valvePin.userData.role = 'round-valve-gear-pin-captured-by-the-open-gab';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.position.set(valvePinLocal.x, valvePinLocal.y, 0);
  valvePinAnchor.userData.role = 'exact-valve-pin-center-anchor';
  const valvePinIndex = new THREE.Group();
  valvePinIndex.position.set(valvePinLocal.x, valvePinLocal.y, 0.92);
  valvePinIndex.userData.role = 'valve-gear-pin-face-anchor';
  const valveShaftIndex = new THREE.Group();
  valveShaftIndex.userData.role = 'valve-rockshaft-angle-anchor';
  const camSupportShoe = makeBeam(
    new THREE.Vector3(supportLeftLocal.x, supportLeftLocal.y, .23),
    new THREE.Vector3(supportRightLocal.x, supportRightLocal.y, .23),
    {
      color: PALETTE.driven,
      depth: 0.14,
      jointRadius: 0.001,
      thickness: 0.17,
    },
  );
  camSupportShoe.position.y -= camToeRadius + .085;
  camSupportShoe.userData.role =
    'rear-valve-lever-shoulder-supporting-the-upper-cam';
  const camSupportAnchor = new THREE.Group();
  camSupportAnchor.position.set(
    camSupportValveLocal.x,
    camSupportValveLocal.y,
    .23,
  );
  camSupportAnchor.userData.role = 'center-of-valve-lever-cam-support-line';
  valveRocker.add(
    camSupportAnchor,
    camSupportShoe,
    valveArm,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  );
  root.add(valveRocker);

  const eccentricRod = new THREE.Group();
  eccentricRod.position.z = 0.14;
  eccentricRod.userData.role =
    'reciprocating-eccentric-rod-with-open-gab-and-integral-lower-grip';
  // One plate: the broken-off rod (y 225.5-259.5), the 55-pixel round crown
  // about the gab, the integral lower handle and the gab slot.
  const rodBarBottom = -gabMouthDepth;
  const rodBody = sourcePlate([
    [[15, 225.5], [262, 225.5], [300, 200], [355, 205], [362, 214], [375, 228],
      [400, 236], [450, 238], [500, 239], [506, 242], [510, 250], [507, 257],
      [500, 259.5], [15, 259.5]],
    polygonClipping.intersection(
      poly(circle([0, 0], rodCrownRadius, 128)),
      poly([[-2, rodBarBottom], [2, rodBarBottom], [2, 2], [-2, 2]]),
    ),
  ], rodFromRaster, -0.19, 0.19, driverMaterial, [
    poly([[-gabInnerHalfWidth, rodBarBottom - .1], [gabInnerHalfWidth, rodBarBottom - .1],
      [gabInnerHalfWidth, gabTopBridgeMinimumY], [-gabInnerHalfWidth, gabTopBridgeMinimumY]]),
  ]);
  rodBody.userData.role = 'eccentric-rod-with-round-crown-gab-slot-and-lower-handle';
  const rodLeftBody = rodBody;
  const rodCrownBody = rodBody;
  const gabTopBridge = rodBody;
  const gabJaws = [-1, 1].map((sign) => {
    const jaw = new THREE.Group();
    jaw.position.set(sign * (gabInnerHalfWidth + gabJawWidth / 2), 0, 0);
    jaw.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-jaw-of-rod-bar`;
    eccentricRod.add(jaw);
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((sign) => {
    const face = new THREE.Group();
    face.position.set(sign * gabInnerHalfWidth, 0, 0);
    face.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-slot-face`;
    eccentricRod.add(face);
    return face;
  });
  const lowerHandle = rodBody;
  const lowerHandleGrip = new THREE.Group();
  lowerHandleGrip.position.set(lowerGripLocal.x, lowerGripLocal.y, 0);
  lowerHandleGrip.userData.role = 'source-lower-rigid-handle-grip-anchor';
  const lowerGripAnchor = new THREE.Group();
  lowerGripAnchor.position.set(lowerGripLocal.x, lowerGripLocal.y, 0);
  lowerGripAnchor.userData.role = 'exact-integral-lower-grip-center';
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.userData.role = 'exact-center-of-eccentric-rod-gab';
  const offFrameRodIndex = new THREE.Group();
  offFrameRodIndex.userData.role = 'eccentric-rod-stroke-anchor';
  eccentricRod.add(
    gabCenterAnchor,
    lowerGripAnchor,
    lowerHandleGrip,
    offFrameRodIndex,
    rodBody,
  );
  root.add(eccentricRod);

  const upperCamHandle = new THREE.Group();
  upperCamHandle.position.set(camPivotLocal.x, camPivotLocal.y, -0.285);
  upperCamHandle.userData.axis = Z_AXIS.clone();
  upperCamHandle.userData.role =
    'separate-upper-cam-handle-pivoted-on-the-eccentric-rod';
  // Traced upper handle; its lower left edge is the plate's dashed line
  // behind the crown. The round toe sits on its rear face.
  const upperCamBody = sourcePlate([[
    [270, 172], [360, 172], [370, 179], [380, 184], [395, 187], [430, 184],
    [500, 184], [507, 190], [508, 200], [500, 207], [450, 206], [410, 204],
    [395, 204], [380, 208], [368, 214], [358, 220], [330, 222], [305, 218],
    [290, 210], [276, 198], [270, 188],
  ]], camFromRaster, -0.075, 0.075, accentMaterial, [
    poly(circle([0, 0], .132, 48)),
  ]);
  upperCamBody.userData.role = 'curved-cam-and-upper-lifting-handle';
  const camContactNose = cylinderAlongZ(camToeRadius, .14, accentMaterial, 128);
  camContactNose.position.set(camContactLocal.x, camContactLocal.y, -.14);
  const camToeNeck = camContactNose;
  camContactNose.userData.role =
    'finite-round-cam-toe-bearing-on-rear-valve-lever-shoulder';
  const upperHandleGrip = new THREE.Group();
  upperHandleGrip.position.set(upperGripLocal.x, upperGripLocal.y, 0);
  upperHandleGrip.userData.role = 'source-upper-moving-handle-grip-anchor';
  const upperGripAnchor = new THREE.Group();
  upperGripAnchor.position.set(upperGripLocal.x, upperGripLocal.y, 0);
  upperGripAnchor.userData.role = 'exact-upper-moving-grip-center';
  const upperHandleIndex = new THREE.Group();
  upperHandleIndex.userData.role = 'upper-cam-handle-angle-anchor';
  upperCamHandle.add(
    camContactNose,
    upperCamBody,
    upperGripAnchor,
    upperHandleGrip,
    upperHandleIndex,
  );
  const camPivotPin = cylinderAlongZ(0.12, 0.55, darkMaterial, 30);
  camPivotPin.position.set(camPivotLocal.x, camPivotLocal.y, -0.085);
  camPivotPin.userData.role =
    'independent-upper-handle-pivot-fixed-through-the-eccentric-rod';
  eccentricRod.add(camPivotPin, upperCamHandle);

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-frame-supporting-the-valve-rockshaft';
  const frameBeams = [];
  const valveBearing = new THREE.Group();
  valveBearing.userData.role = 'rear-valve-rockshaft-bearing';
  frame.add(valveBearing);
  root.add(frame);

  // State markers are anchors only: the plate draws no contact dots.
  const camContactMarker = new THREE.Group();
  camContactMarker.userData.role = 'upper-cam-to-valve-shoe-contact-anchor';
  const gabCaptureMarker = new THREE.Group();
  gabCaptureMarker.userData.role = 'gab-pin-capture-anchor';
  const heldClearMarker = new THREE.Group();
  heldClearMarker.userData.role = 'operator-held-gab-clearance-anchor';
  root.add(camContactMarker, gabCaptureMarker, heldClearMarker);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 6.6, 3.1),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-1.06, 0.62, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    cameraEnvelope,
    camContactMarker,
    camContactNose,
    camToeNeck,
    camPivotPin,
    camSupportAnchor,
    camSupportShoe,
    eccentricRod,
    frame,
    frameBeams,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabJaws,
    gabTopBridge,
    heldClearMarker,
    lowerGripAnchor,
    lowerHandle,
    lowerHandleGrip,
    offFrameRodIndex,
    rodBody,
    rodCrownBody,
    rodLeftBody,
    upperCamBody,
    upperCamHandle,
    upperGripAnchor,
    upperHandleGrip,
    upperHandleIndex,
    valveArm,
    valveBearing,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveRocker,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  };

  const geometry = {
    camToeRadius,
    camContactLocal: camContactLocal.clone(),
    camPivotLocal: camPivotLocal.clone(),
    camSupportHalfLength,
    camSupportValveLocal: camSupportValveLocal.clone(),
    cyclePeriod,
    fullClearCouplingEnd,
    fullClearCouplingStart,
    gabInnerHalfWidth,
    gabJawWidth,
    gabMouthDepth,
    gabPinRadius,
    gabTopBridgeMaximumY,
    gabTopBridgeMinimumY,
    inputTurnsPerCycle,
    lowerGripLocal: lowerGripLocal.clone(),
    maximumGabLift,
    maximumHandleAngle,
    rodLeftEndLocal: rodLeftEndLocal.clone(),
    rodStroke,
    sequenceBreaks,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCamContact: sourceRasterCamContact.clone(),
    sourceRasterCamPivot: sourceRasterCamPivot.clone(),
    sourceRasterGabPin: sourceRasterGabPin.clone(),
    sourceRasterLowerGrip: sourceRasterLowerGrip.clone(),
    sourceRasterRodLeftEnd: sourceRasterRodLeftEnd.clone(),
    sourceRasterSupportLeft: sourceRasterSupportLeft.clone(),
    sourceRasterSupportRight: sourceRasterSupportRight.clone(),
    sourceRasterUpperGrip: sourceRasterUpperGrip.clone(),
    sourceRasterValvePivot: sourceRasterValvePivot.clone(),
    sourceUnitsPerPixel,
    supportLeftLocal: supportLeftLocal.clone(),
    supportRightLocal: supportRightLocal.clone(),
    upperGripLocal: upperGripLocal.clone(),
    valveArmLength,
    valvePinLocal: valvePinLocal.clone(),
    valvePivot: valvePivot.clone(),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveRocker.rotation.z = state.rockerAngle;
    eccentricRod.position.set(state.gabCenter.x, state.gabCenter.y, 0.14);
    upperCamHandle.rotation.z = state.camAngle;
    camContactMarker.position.set(
      state.camSurfacePoint.x,
      state.camSurfacePoint.y,
      0.56,
    );
    camContactMarker.visible = state.camLiftActive;
    gabCaptureMarker.position.set(state.valvePin.x, state.valvePin.y, 1.18);
    gabCaptureMarker.visible = state.gabCaptured;
    heldClearMarker.position.set(
      state.gabCenter.x,
      state.gabCenter.y - gabMouthDepth,
      0.84,
    );
    heldClearMarker.visible = state.operatorHoldingHandle;
    root.userData.contacts = {
      camShoulder: {
        active: state.camContactActive,
        contactError: state.camContactError,
        point: state.camSurfacePoint.clone(),
        toeCenter: state.camContactPoint.clone(),
        withinSupport: state.camContactWithinSupport,
      },
      gabPin: {
        captured: state.gabCaptured,
        clearance: state.minimumGabSolidClearance,
        fullyClear: state.pinFullyClearBelowGab,
        gabCenter: state.gabCenter.clone(),
        pin: state.valvePin.clone(),
      },
      twoHandleOperator: {
        holding: state.operatorHoldingHandle,
        lowerGrip: state.lowerGrip.clone(),
        upperGrip: state.upperGrip.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    engagedRunning: cyclePeriod * 0.10,
    handleHalfRaised: cyclePeriod * 0.32,
    heldClearPositiveStroke: cyclePeriod * 0.465,
    heldClearStopped: cyclePeriod * 0.68,
    handleHalfLowered: cyclePeriod * 0.77,
    nextEngagedRunning: cyclePeriod * 0.92,
    sourceEngaged: 0,
  };
  const canonicalStates = {
    engagedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: Math.PI / 2,
    }),
    fullyLiftedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: Math.PI / 2,
    }),
    fullyLiftedStopped: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: 0,
    }),
    sourceEngaged: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 0,
    }),
  };

  root.userData.archetype =
    'two-handle-cam-lifted-eccentric-rod-gab-pin-release';
  root.userData.blocks = blocks;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.handleLiftAtAngle = handleLiftAtAngle;
  root.userData.inputMotionAtCyclePhase = inputMotionAtCyclePhase;
  root.userData.mechanism =
    'rod-integral-lower-grip-and-pivoted-upper-cam-handle-lift-downward-opening-gab-off-valve-pin';
  root.userData.nominalRockerAngleAtInput = nominalRockerAngleAtInput;
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.sourceRasterFromPoint = sourceRasterFromPoint;
  root.userData.stateAtConfiguration = stateAtConfiguration;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.00;
  root.userData.fidelity = 'authored';

  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    camContactMarker,
    gabCaptureMarker,
    heldClearMarker,
    offFrameRodIndex,
    upperHandleIndex,
    valvePinIndex,
    valveShaftIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(4.4, 3.1, 15.2),
    root,
    update,
  };
}

function loopHandlePinCamGabDisengager() {
  const root = new THREE.Group();

  // In Brown's 188 plate the long loop, its hidden working cam, and notch a
  // are one rigid lever pivoted on the eccentric rod. The separate leaf
  // spring is screwed to that rod. Hidden lines show the cam bearing directly
  // on the same valve pin captured by the open-bottom gab; there is no remote
  // rocker shoulder like 186/187. The handle first lifts on a conjugate cam,
  // then overtravels onto a relieved profile so the spring can latch it and
  // the released rod can reciprocate without striking the stationary pin.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterGabPin = new THREE.Vector2(394, 322);
  const sourceRasterCamPivot = new THREE.Vector2(287, 290);
  const sourceRasterLoopGrip = new THREE.Vector2(35, 112);
  const sourceRasterNotchA = new THREE.Vector2(224, 174);
  // The screw root sits within the rod's silhouette, below the loop's sweep.
  const sourceRasterLeafAnchor = new THREE.Vector2(138, 306);
  const sourceRasterLeafFreeTip = new THREE.Vector2(223, 201);
  const sourceRasterCamBackCrown = new THREE.Vector2(378, 229);
  const sourceRasterRodLeftEnd = new THREE.Vector2(15, 319);
  const sourceRasterRodRightEnd = new THREE.Vector2(518, 326);
  const sourceUnitsPerPixel = 0.017;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterGabPin.x) * sourceUnitsPerPixel,
    (sourceRasterGabPin.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceRasterFromPoint = (point) => new THREE.Vector2(
    sourceRasterGabPin.x + point.x / sourceUnitsPerPixel,
    sourceRasterGabPin.y - point.y / sourceUnitsPerPixel,
  );

  const camPivotLocal = sourcePointFromRaster(sourceRasterCamPivot);
  const loopGripLocal = sourcePointFromRaster(sourceRasterLoopGrip)
    .sub(camPivotLocal);
  const notchALocal = sourcePointFromRaster(sourceRasterNotchA)
    .sub(camPivotLocal);
  const leafAnchorLocal = sourcePointFromRaster(sourceRasterLeafAnchor);
  const leafRestTipLocal = sourcePointFromRaster(sourceRasterLeafFreeTip);
  const rodLeftEndLocal = sourcePointFromRaster(sourceRasterRodLeftEnd);
  const rodRightEndLocal = sourcePointFromRaster(sourceRasterRodRightEnd);
  const camBackCrownLocal = sourcePointFromRaster(sourceRasterCamBackCrown)
    .sub(camPivotLocal);
  const leafRestPathLocal = [
    sourceRasterLeafAnchor,
    new THREE.Vector2(180, 283),
    new THREE.Vector2(206, 262),
    new THREE.Vector2(221, 232),
    sourceRasterLeafFreeTip,
  ].map(sourcePointFromRaster);

  const rodStroke = 0.28;
  const maximumHandleAngle = 0.70;
  const workingCamEndAngle = 0.50;
  const workingHandleFraction = workingCamEndAngle / maximumHandleAngle;
  const maximumGabLift = 0.68;
  const maximumCamRelief = 0.38;
  // Plate: a 17-pixel pin in a slot cut up from the rod's lower edge into
  // the raised crown, whose top is 62 pixels above the pin center.
  const gabPinRadius = 0.28;
  const gabInnerHalfWidth = gabPinRadius + 0.05;
  const gabJawWidth = 0.5;
  const gabMouthDepth = 0.30;
  const gabTopBridgeMinimumY = 0.33;
  const gabTopBridgeMaximumY = 1.05;
  const fullClearCouplingStart = gabMouthDepth + gabPinRadius + 0.03;
  const fullClearCouplingEnd = gabMouthDepth + gabPinRadius + 0.07;
  const springMaximumDeflection = 0.14;
  const leafStrapPoints = 49;
  const leafSpringRestZ = -0.53;
  // Measured at the latched pose so the mouth faces the arriving spring tip.
  const notchMouthAngle = -2.13;
  const loopStrapPoints = [
    [272, 282], [245, 258], [215, 228], [185, 197], [150, 165], [110, 155],
    [70, 150], [35, 140], [20, 118], [30, 95], [60, 82], [100, 76],
    [140, 78], [180, 90], [208, 108], [225, 132], [232, 158], [228, 176],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const camLawAtHandleAngle = (handleAngle) => {
    const angle = THREE.MathUtils.clamp(
      handleAngle,
      0,
      maximumHandleAngle,
    );
    const workingNormalized = THREE.MathUtils.clamp(
      angle / workingCamEndAngle,
      0,
      1,
    );
    const workingLaw = smootherstepLaw(workingNormalized);
    const lift = maximumGabLift * workingLaw.value;
    const liftDerivativeByAngle = angle < workingCamEndAngle
      ? maximumGabLift * workingLaw.firstDerivative / workingCamEndAngle
      : 0;
    const liftSecondDerivativeByAngle = angle < workingCamEndAngle
      ? maximumGabLift * workingLaw.secondDerivative
        / workingCamEndAngle ** 2
      : 0;
    const reliefNormalized = THREE.MathUtils.clamp(
      (angle - workingCamEndAngle)
        / (maximumHandleAngle - workingCamEndAngle),
      0,
      1,
    );
    const reliefLaw = smootherstepLaw(reliefNormalized);
    const relief = maximumCamRelief * reliefLaw.value;
    return {
      angle,
      lift,
      liftDerivativeByAngle,
      liftSecondDerivativeByAngle,
      relief,
      reliefNormalized,
      workingNormalized,
    };
  };

  const camProfileAtHandleAngle = (handleAngle) => {
    const law = camLawAtHandleAngle(handleAngle);
    const pinFromPivotWorld = new THREE.Vector2(
      -camPivotLocal.x,
      -law.lift - camPivotLocal.y,
    );
    const pitchPointLocal = rotate2(-law.angle, pinFromPivotWorld);
    const pitchDerivativeWorld = new THREE.Vector2(
      pinFromPivotWorld.y,
      -law.liftDerivativeByAngle - pinFromPivotWorld.x,
    );
    const pitchTangentLocal = rotate2(
      -law.angle,
      pitchDerivativeWorld,
    ).normalize();
    let profileNormalLocal = new THREE.Vector2(
      -pitchTangentLocal.y,
      pitchTangentLocal.x,
    );
    if (profileNormalLocal.dot(pitchPointLocal.clone().negate()) < 0) {
      profileNormalLocal.negate();
    }
    const profilePointLocal = pitchPointLocal.clone().addScaledVector(
      profileNormalLocal,
      gabPinRadius + law.relief,
    );
    return {
      ...law,
      pitchPointLocal,
      pitchTangentLocal,
      profileNormalLocal,
      profilePointLocal,
    };
  };

  const camProfileSampleCount = 160;
  const camProfilePointsLocal = Array.from(
    { length: camProfileSampleCount + 1 },
    (_, index) => camProfileAtHandleAngle(
      maximumHandleAngle * index / camProfileSampleCount,
    ).profilePointLocal,
  );
  if (maximumGabLift <= fullClearCouplingEnd) {
    throw new RangeError('Movement 188 cam cannot lift the gab clear of its pin.');
  }

  const cyclePeriod = 18;
  const inputTurnsPerCycle = 6;
  const sequenceBreaks = Object.freeze({
    engagedRunEnd: 0.18,
    handleLiftStart: 0.22,
    camLiftEnd: 0.34,
    handleLatchEnd: 0.40,
    latchedRunEnd: 0.64,
    springReleaseEnd: 0.70,
    reliefReturnEnd: 0.76,
    camLowerEnd: 0.88,
  });

  const inputMotionAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let turns = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 2,
    };
    if (phase < sequenceBreaks.engagedRunEnd) {
      turns = transitionLaw(
        phase,
        0,
        sequenceBreaks.engagedRunEnd,
        0,
        2,
      );
    } else if (phase < sequenceBreaks.handleLatchEnd) {
      turns.value = 2;
    } else if (phase < sequenceBreaks.latchedRunEnd) {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLatchEnd,
        sequenceBreaks.latchedRunEnd,
        2,
        4,
      );
    } else if (phase < sequenceBreaks.camLowerEnd) {
      turns.value = 4;
    } else {
      turns = transitionLaw(
        phase,
        sequenceBreaks.camLowerEnd,
        1,
        4,
        inputTurnsPerCycle,
      );
    }
    return {
      accelerationPerPhaseSquared:
        FULL_TURN * turns.accelerationPerPhaseSquared,
      angle: FULL_TURN * turns.value,
      phase,
      ratePerPhase: FULL_TURN * turns.ratePerPhase,
      turns: turns.value,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let handle = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.handleLiftStart
        && phase < sequenceBreaks.camLiftEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleLiftStart,
        sequenceBreaks.camLiftEnd,
        0,
        workingHandleFraction,
      );
    } else if (
      phase >= sequenceBreaks.camLiftEnd
        && phase < sequenceBreaks.handleLatchEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.camLiftEnd,
        sequenceBreaks.handleLatchEnd,
        workingHandleFraction,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handleLatchEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      handle.value = 1;
    } else if (
      phase >= sequenceBreaks.springReleaseEnd
        && phase < sequenceBreaks.reliefReturnEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.springReleaseEnd,
        sequenceBreaks.reliefReturnEnd,
        1,
        workingHandleFraction,
      );
    } else if (
      phase >= sequenceBreaks.reliefReturnEnd
        && phase < sequenceBreaks.camLowerEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.reliefReturnEnd,
        sequenceBreaks.camLowerEnd,
        workingHandleFraction,
        0,
      );
    }

    let latch = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.camLiftEnd
        && phase < sequenceBreaks.handleLatchEnd
    ) {
      latch = transitionLaw(
        phase,
        sequenceBreaks.camLiftEnd,
        sequenceBreaks.handleLatchEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handleLatchEnd
        && phase < sequenceBreaks.latchedRunEnd
    ) {
      latch.value = 1;
    } else if (
      phase >= sequenceBreaks.latchedRunEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      latch = transitionLaw(
        phase,
        sequenceBreaks.latchedRunEnd,
        sequenceBreaks.springReleaseEnd,
        1,
        0,
      );
    }

    let spring = { ratePerPhase: 0, value: 0 };
    if (
      phase >= sequenceBreaks.camLiftEnd
        && phase < sequenceBreaks.handleLatchEnd
    ) {
      spring = bumpLaw(
        phase,
        sequenceBreaks.camLiftEnd,
        sequenceBreaks.handleLatchEnd,
        -springMaximumDeflection,
      );
    } else if (
      phase >= sequenceBreaks.latchedRunEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      spring = bumpLaw(
        phase,
        sequenceBreaks.latchedRunEnd,
        sequenceBreaks.springReleaseEnd,
        -springMaximumDeflection,
      );
    }

    let stage = 'engaged-eccentric-rod-driving-valve-pin';
    if (
      phase >= sequenceBreaks.engagedRunEnd
        && phase < sequenceBreaks.handleLiftStart
    ) stage = 'eccentric-stopped-with-direct-cam-aligned-to-pin';
    else if (
      phase >= sequenceBreaks.handleLiftStart
        && phase < sequenceBreaks.camLiftEnd
    ) stage = 'loop-handle-cam-lifting-gab-directly-from-pin';
    else if (
      phase >= sequenceBreaks.camLiftEnd
        && phase < sequenceBreaks.handleLatchEnd
    ) stage = 'loop-handle-overtravel-leaf-spring-passing-notch-a';
    else if (
      phase >= sequenceBreaks.handleLatchEnd
        && phase < sequenceBreaks.latchedRunEnd
    ) stage = 'leaf-spring-latched-gab-clear-while-eccentric-rod-runs';
    else if (
      phase >= sequenceBreaks.latchedRunEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) stage = 'leaf-spring-flexing-out-of-notch-a';
    else if (
      phase >= sequenceBreaks.springReleaseEnd
        && phase < sequenceBreaks.reliefReturnEnd
    ) stage = 'loop-handle-returning-through-relieved-cam-overtravel';
    else if (
      phase >= sequenceBreaks.reliefReturnEnd
        && phase < sequenceBreaks.camLowerEnd
    ) stage = 'direct-pin-cam-lowering-gab-to-recapture';
    else if (phase >= sequenceBreaks.camLowerEnd) {
      stage = 'gab-recaptured-eccentric-rod-driving-valve-pin';
    }

    return {
      handleAccelerationPerPhaseSquared:
        handle.accelerationPerPhaseSquared,
      handleFraction: handle.value,
      handleRatePerPhase: handle.ratePerPhase,
      latchAccelerationPerPhaseSquared:
        latch.accelerationPerPhaseSquared,
      latchEngagement: latch.value,
      latchRatePerPhase: latch.ratePerPhase,
      phase,
      springDeflection: spring.value,
      springDeflectionRatePerPhase: spring.ratePerPhase,
      stage,
    };
  };

  const notchALocalAtHandleAngle = (handleAngle) => camPivotLocal
    .clone()
    .add(rotate2(handleAngle, notchALocal));
  const loopGripLocalAtHandleAngle = (handleAngle) => camPivotLocal
    .clone()
    .add(rotate2(handleAngle, loopGripLocal));
  const leafSpringPointsAtConfiguration = ({
    handleAngle,
    latchEngagement,
    springDeflection,
  }) => {
    const notchLocal = notchALocalAtHandleAngle(handleAngle);
    const desiredTip = leafRestTipLocal.clone().lerp(
      notchLocal,
      latchEngagement,
    );
    const tipDisplacement = desiredTip.clone().sub(leafRestTipLocal);
    return leafRestPathLocal.map((restPoint, index) => {
      const normalized = index / (leafRestPathLocal.length - 1);
      const bendWeight = smootherstepLaw(normalized).value;
      return new THREE.Vector3(
        restPoint.x + tipDisplacement.x * bendWeight,
        restPoint.y + tipDisplacement.y * bendWeight,
        leafSpringRestZ + springDeflection * bendWeight,
      );
    });
  };

  const stateAtConfiguration = ({
    handleAcceleration = 0,
    handleAngularVelocity = 0,
    handleFraction = 0,
    inputAngle = 0,
    latchEngagement = 0,
    springDeflection = 0,
  }) => {
    const resolvedInputAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const resolvedHandleFraction = THREE.MathUtils.clamp(
      handleFraction,
      0,
      1,
    );
    const handleAngle = maximumHandleAngle * resolvedHandleFraction;
    const cam = camProfileAtHandleAngle(handleAngle);
    const gabLift = cam.lift;
    const gabLiftVelocity = cam.liftDerivativeByAngle
      * handleAngularVelocity;
    const gabLiftAcceleration = cam.liftSecondDerivativeByAngle
      * handleAngularVelocity ** 2
      + cam.liftDerivativeByAngle * handleAcceleration;
    const gabCenter = new THREE.Vector2(
      rodStroke * Math.sin(resolvedInputAngle),
      gabLift,
    );
    const clearNormalized = THREE.MathUtils.clamp(
      (gabLift - fullClearCouplingStart)
        / (fullClearCouplingEnd - fullClearCouplingStart),
      0,
      1,
    );
    const couplingBlend = 1 - smootherstepLaw(clearNormalized).value;
    const nominalValvePinX = gabCenter.x;
    const valvePin = new THREE.Vector2(
      nominalValvePinX * couplingBlend,
      0,
    );
    const pinRelativeToGab = valvePin.clone().sub(gabCenter);
    const camPivot = gabCenter.clone().add(camPivotLocal);
    const camProfilePoint = camPivot.clone().add(
      rotate2(handleAngle, cam.profilePointLocal),
    );
    const camProfileNormalWorld = rotate2(
      handleAngle,
      cam.profileNormalLocal,
    );
    const pinSurfacePoint = valvePin.clone().addScaledVector(
      camProfileNormalWorld,
      gabPinRadius,
    );
    const camPinIntendedGap = camProfilePoint.distanceTo(pinSurfacePoint);

    const cosine = Math.cos(handleAngle);
    const sine = Math.sin(handleAngle);
    let camProfileMinimumGap = Infinity;
    for (const point of camProfilePointsLocal) {
      const worldX = camPivot.x + cosine * point.x - sine * point.y;
      const worldY = camPivot.y + sine * point.x + cosine * point.y;
      camProfileMinimumGap = Math.min(
        camProfileMinimumGap,
        Math.hypot(worldX - valvePin.x, worldY - valvePin.y)
          - gabPinRadius,
      );
    }
    // Include the analytical point at the current handle angle as well as the
    // sampled render mesh. This preserves exact tangency between samples while
    // the sampled points guard the rest of the rigid profile against contact.
    camProfileMinimumGap = Math.min(
      camProfileMinimumGap,
      camProfilePoint.distanceTo(valvePin) - gabPinRadius,
    );

    const notchALocalPosition = notchALocalAtHandleAngle(handleAngle);
    const notchA = gabCenter.clone().add(notchALocalPosition);
    const loopGrip = gabCenter.clone().add(
      loopGripLocalAtHandleAngle(handleAngle),
    );
    const leafSpringPointsLocal = leafSpringPointsAtConfiguration({
      handleAngle,
      latchEngagement: THREE.MathUtils.clamp(latchEngagement, 0, 1),
      springDeflection,
    });
    const leafSpringTipLocal = leafSpringPointsLocal.at(-1);
    const leafSpringTip = gabCenter.clone().add(
      new THREE.Vector2(leafSpringTipLocal.x, leafSpringTipLocal.y),
    );
    const latchPlanarGap = leafSpringTip.distanceTo(notchA);
    const latchGap = Math.hypot(latchPlanarGap, springDeflection);
    const latchCaptureError = latchEngagement >= 1 - 1e-12
      ? latchGap
      : 0;

    const jawMinimumY = -gabMouthDepth;
    const jawMaximumY = gabTopBridgeMaximumY;
    const leftJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(-gabInnerHalfWidth - gabJawWidth, jawMinimumY),
      new THREE.Vector2(-gabInnerHalfWidth, jawMaximumY),
    ) - gabPinRadius;
    const rightJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(gabInnerHalfWidth, jawMinimumY),
      new THREE.Vector2(
        gabInnerHalfWidth + gabJawWidth,
        jawMaximumY,
      ),
    ) - gabPinRadius;
    const topBridgeClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(-gabInnerHalfWidth, gabTopBridgeMinimumY),
      new THREE.Vector2(gabInnerHalfWidth, gabTopBridgeMaximumY),
    ) - gabPinRadius;
    const minimumGabSolidClearance = Math.min(
      leftJawClearance,
      rightJawClearance,
      topBridgeClearance,
    );
    const pinInsideGabMouth = (
      Math.abs(pinRelativeToGab.x) + gabPinRadius
        <= gabInnerHalfWidth + 1e-10
        && pinRelativeToGab.y - gabPinRadius
          >= -gabMouthDepth - 1e-10
        && pinRelativeToGab.y + gabPinRadius
          <= gabTopBridgeMinimumY + 1e-10
    );
    const pinFullyClearBelowGab = pinRelativeToGab.y + gabPinRadius
      < -gabMouthDepth;
    const gabCaptured = gabLift <= 1e-12
      && couplingBlend >= 1 - 1e-12
      && pinInsideGabMouth;

    return {
      camPinIntendedGap,
      camPivot,
      camProfileMinimumGap,
      camProfileNormalWorld,
      camProfilePoint,
      camProfileRelief: cam.relief,
      camProfileTangentLocal: cam.pitchTangentLocal.clone(),
      camProfileWorkingNormalLocal: cam.profileNormalLocal.clone(),
      couplingBlend,
      gabCaptured,
      gabCenter,
      gabLift,
      gabLiftAcceleration,
      gabLiftVelocity,
      handleAcceleration,
      handleAngle,
      handleAngularVelocity,
      handleFraction: resolvedHandleFraction,
      inputAngle: resolvedInputAngle,
      latchCaptureError,
      latchEngagement: THREE.MathUtils.clamp(latchEngagement, 0, 1),
      latchGap,
      latchPlanarGap,
      leafSpringPointsLocal,
      leafSpringTip,
      leafSpringTipLocal: leafSpringTipLocal.clone(),
      leftJawClearance,
      loopGrip,
      minimumGabSolidClearance,
      nominalValvePinX,
      notchA,
      notchALocalPosition,
      pinFullyClearBelowGab,
      pinInsideGabMouth,
      pinRelativeToGab,
      pinSurfacePoint,
      rightJawClearance,
      springDeflection,
      topBridgeClearance,
      valvePin,
    };
  };

  const stateAtInputAngle = (inputAngle, handleFraction = 0) => (
    stateAtConfiguration({ handleFraction, inputAngle })
  );
  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const input = inputMotionAtCyclePhase(sequence.phase);
    const phaseRate = 1 / cyclePeriod;
    const handleAngularVelocity = maximumHandleAngle
      * sequence.handleRatePerPhase
      * phaseRate;
    const handleAcceleration = maximumHandleAngle
      * sequence.handleAccelerationPerPhaseSquared
      * phaseRate ** 2;
    const state = stateAtConfiguration({
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: sequence.handleFraction,
      inputAngle: input.angle,
      latchEngagement: sequence.latchEngagement,
      springDeflection: sequence.springDeflection,
    });
    state.cyclePhase = sequence.phase;
    state.inputAngularAcceleration = input.accelerationPerPhaseSquared
      * phaseRate ** 2;
    state.inputAngularSpeed = input.ratePerPhase * phaseRate;
    state.inputTurns = input.turns;
    state.latchAcceleration = sequence.latchAccelerationPerPhaseSquared
      * phaseRate ** 2;
    state.latchRate = sequence.latchRatePerPhase * phaseRate;
    state.springDeflectionRate = sequence.springDeflectionRatePerPhase
      * phaseRate;
    state.stage = sequence.stage;
    state.camContactActive = (
      sequence.stage === 'loop-handle-cam-lifting-gab-directly-from-pin'
        || sequence.stage === 'direct-pin-cam-lowering-gab-to-recapture'
    );
    state.camRelievedForRodMotion = (
      sequence.stage
        === 'leaf-spring-latched-gab-clear-while-eccentric-rod-runs'
        || sequence.stage === 'leaf-spring-flexing-out-of-notch-a'
    );
    return state;
  };
  const stateAtTime = (time) => {
    const state = stateAtCyclePhase(time / cyclePeriod);
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.19,
    roughness: 0.51,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  // Source-traced visible bodies (0.017 units per plate pixel). Front to
  // back: the rod with its raised crown and tail; the rigid loop/cam, whose
  // bean and descending working edge the plate dashes behind the rod; the
  // leaf spring, which the loop's diagonal crosses in front of.
  const rodFromRaster = (point) => sourcePointFromRaster(point);
  const camFromRaster = (point) => sourcePointFromRaster(point).sub(camPivotLocal);
  const valveGear = new THREE.Group();
  valveGear.position.z = -0.30;
  valveGear.userData.role =
    'locally-rendered-guided-valve-gear-carrier-with-gab-pin';
  const valvePin = cylinderAlongZ(gabPinRadius, 0.97, brassMaterial, 40);
  valvePin.position.z = 0.165;
  valvePin.userData.role =
    'round-valve-gear-pin-serving-as-gab-capture-and-direct-cam-follower';
  const valvePinBoss = boredBoss(0.34, 0.12, gabPinRadius + .012, drivenMaterial);
  valvePinBoss.position.z = -0.26;
  valvePinBoss.userData.role = 'rear-boss-of-guided-valve-gear-pin';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.userData.role = 'exact-valve-pin-center-anchor';
  const valvePinIndex = new THREE.Group();
  valvePinIndex.position.z = 0.65;
  valvePinIndex.userData.role = 'valve-gear-pin-face-anchor';
  const valveCarrierTongue = new THREE.Group();
  valveCarrierTongue.userData.role = 'rear-guided-valve-gear-pin-carrier-anchor';
  const valveCarrierWeb = new THREE.Mesh(plate(polygonClipping.difference(
    poly(circle([0, 0], .34, 64)),
    poly(circle([0, 0], gabPinRadius + .012, 64))), -.03, .03), drivenMaterial);
  valveCarrierWeb.position.z = -.17;
  valveCarrierWeb.userData.role = 'valve-pin-carrier-collar';
  valveGear.add(
    valveCarrierTongue,
    valveCarrierWeb,
    valvePin,
    valvePinAnchor,
    valvePinBoss,
    valvePinIndex,
  );
  root.add(valveGear);

  const eccentricRod = new THREE.Group();
  eccentricRod.position.z = 0.12;
  eccentricRod.userData.role =
    'reciprocating-eccentric-rod-with-downward-gab-loop-cam-and-leaf-latch';
  const rodBarBottom = -gabMouthDepth;
  const rodBottomRaster = sourceRasterGabPin.y + gabMouthDepth / sourceUnitsPerPixel;
  const rodBody = sourcePlate([[
    [15, 297], [362, 297], [364, 280], [372, 267], [397, 260], [420, 267],
    [440, 287], [450, 305], [460, 313], [483, 315], [512, 317], [518, 322],
    [518, rodBottomRaster - 6], [512, rodBottomRaster], [15, rodBottomRaster],
  ]], rodFromRaster, -0.19, 0.19, driverMaterial, [
    poly([[-gabInnerHalfWidth, rodBarBottom - .1], [gabInnerHalfWidth, rodBarBottom - .1],
      [gabInnerHalfWidth, gabTopBridgeMinimumY], [-gabInnerHalfWidth, gabTopBridgeMinimumY]]),
  ]);
  rodBody.userData.role = 'eccentric-rod-with-raised-crown-gab-slot-and-tail';
  const rodLeftBody = rodBody;
  const rodMiddleBody = rodBody;
  const rodRightTail = rodBody;
  const gabTopBridge = rodBody;
  const gabCrownArch = rodBody;
  const gabJaws = [-1, 1].map((sign) => {
    const jaw = new THREE.Group();
    jaw.position.set(sign * (gabInnerHalfWidth + gabJawWidth / 2), 0, 0);
    jaw.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-jaw-of-rod-bar`;
    eccentricRod.add(jaw);
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((sign) => {
    const face = new THREE.Group();
    face.position.set(sign * gabInnerHalfWidth, 0, 0);
    face.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-slot-face`;
    eccentricRod.add(face);
    return face;
  });
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.userData.role = 'exact-center-of-eccentric-rod-gab';
  const offFrameRodIndex = new THREE.Group();
  offFrameRodIndex.userData.role = 'eccentric-rod-stroke-anchor';
  eccentricRod.add(gabCenterAnchor, offFrameRodIndex, rodBody);
  root.add(eccentricRod);

  const loopCamHandle = new THREE.Group();
  loopCamHandle.position.set(camPivotLocal.x, camPivotLocal.y, -0.32);
  loopCamHandle.userData.axis = Z_AXIS.clone();
  loopCamHandle.userData.role =
    'single-rigid-loop-handle-with-direct-pin-cam-and-notch-a';
  // Traced flat loop: from the cam boss up the diagonal, round the loop and
  // down its right side to notch a.
  const loopCurvePoints = new THREE.CatmullRomCurve3(loopStrapPoints.map((point) => {
    const local = camFromRaster(point);
    return new THREE.Vector3(local.x, local.y, 0);
  }), false, 'centripetal').getSpacedPoints(120);
  const loopHandleBody = makeFlatStrap(loopCurvePoints.length, .17, .18, accentMaterial);
  loopHandleBody.userData.setPoints(loopCurvePoints);
  loopHandleBody.userData.role = 'source-rigid-flat-loop-handle';
  const handleStem = new THREE.Group();
  handleStem.userData.role = 'rigid-stem-joining-loop-to-cam-pivot-anchor';
  const camLobe = new THREE.Group();
  camLobe.userData.role =
    'slender-conjugate-direct-pin-cam-with-overtravel-relief';
  // Bean-shaped boss and the upper back rising to the plate's crown point.
  const camBackArm = sourcePlate([[
    [258, 298], [261, 284], [271, 276], [287, 271], [300, 269], [315, 261],
    [330, 248], [345, 236], [360, 230], [sourceRasterCamBackCrown.x, sourceRasterCamBackCrown.y],
    [386, 236], [389, 255], [386, 285], [380, 304], [372, 313], [364, 308],
    [366, 290], [370, 262], [366, 248], [356, 252], [345, 262], [335, 278],
    [330, 292], [320, 304], [300, 307], [270, 302],
  ]], camFromRaster, -0.09, 0.09, accentMaterial, [
    poly(circle([0, 0], .132, 48)),
  ]);
  camBackArm.userData.role = 'source-visible-upper-back-of-direct-pin-cam';
  // The working rail's inner surface is the conjugate profile itself.
  const camRailRadius = .085;
  const camWorkingRail = makeTube(
    camProfilePointsLocal.map((point, index) => point.clone().addScaledVector(
      camProfileAtHandleAngle(maximumHandleAngle * index / camProfileSampleCount)
        .profileNormalLocal,
      camRailRadius,
    )),
    camRailRadius,
    accentMaterial,
    0,
  );
  camWorkingRail.userData.role =
    'hidden-conjugate-working-rail-bearing-directly-on-valve-pin';
  const camWorkingEdge = new THREE.Group();
  camWorkingEdge.userData.role = 'working-edge-of-direct-pin-cam-anchor';
  camLobe.add(camBackArm, camWorkingRail);
  // A tab at the loop's end reaches back into the spring plane; notch a is a
  // square mouth that faces the arriving leaf-spring tip when latched.
  const notchAxis = new THREE.Vector2(Math.cos(notchMouthAngle), Math.sin(notchMouthAngle));
  const notchNormal = new THREE.Vector2(-notchAxis.y, notchAxis.x);
  const notchCorner = (along, across) => {
    const point = notchALocal.clone().addScaledVector(notchAxis, along).addScaledVector(notchNormal, across);
    return [point.x, point.y];
  };
  const notchTab = new THREE.Mesh(plate(polygonClipping.difference(
    poly(circle([notchALocal.x, notchALocal.y], .20, 48)),
    poly([notchCorner(-.10, -.14), notchCorner(.6, -.14), notchCorner(.6, .14), notchCorner(-.10, .14)]),
  ), -0.19, 0.0), accentMaterial);
  notchTab.userData.role = 'loop-tab-containing-notch-a';
  const notchLipUpper = new THREE.Group();
  notchLipUpper.position.copy(new THREE.Vector3(...notchCorner(0, .14), -0.21));
  notchLipUpper.userData.role = 'upper-working-lip-of-notch-a';
  const notchLipLower = new THREE.Group();
  notchLipLower.position.copy(new THREE.Vector3(...notchCorner(0, -.14), -0.21));
  notchLipLower.userData.role = 'lower-working-lip-of-notch-a';
  const notchAAnchor = new THREE.Group();
  notchAAnchor.position.set(notchALocal.x, notchALocal.y, -0.21);
  notchAAnchor.userData.role = 'exact-moving-center-of-notch-a';
  const loopGripAnchor = new THREE.Group();
  loopGripAnchor.position.set(loopGripLocal.x, loopGripLocal.y, 0);
  loopGripAnchor.userData.role = 'source-center-of-rigid-loop-grip';
  const handleIndex = new THREE.Group();
  handleIndex.userData.role = 'rigid-loop-handle-angle-anchor';
  loopCamHandle.add(
    camLobe,
    camWorkingEdge,
    handleIndex,
    handleStem,
    loopGripAnchor,
    loopHandleBody,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    notchTab,
  );
  const camPivotPin = cylinderAlongZ(0.12, 0.62, darkMaterial, 30);
  camPivotPin.position.set(camPivotLocal.x, camPivotLocal.y, -0.12);
  camPivotPin.userData.role =
    'loop-handle-cam-pivot-fixed-through-eccentric-rod';
  eccentricRod.add(camPivotPin, loopCamHandle);
  const leafSpring = new THREE.Group();
  const leafStrap = makeFlatStrap(leafStrapPoints, .15, .10, brassMaterial);
  leafStrap.userData.role = 'flat-leaf-spring-strap';
  leafSpring.add(leafStrap);
  leafSpring.userData.role =
    'separate-rod-mounted-leaf-spring-catching-moving-notch-a';
  const leafSpringAnchor = cylinderAlongZ(0.09, 0.47, darkMaterial, 28);
  leafSpringAnchor.position.set(
    leafAnchorLocal.x,
    leafAnchorLocal.y,
    -0.345,
  );
  leafSpringAnchor.userData.role = 'fixed-screw-root-of-leaf-spring';
  const leafSpringTipIndex = new THREE.Group();
  leafSpringTipIndex.position.set(
    leafRestTipLocal.x,
    leafRestTipLocal.y,
    leafSpringRestZ,
  );
  leafSpringTipIndex.userData.role = 'leaf-spring-catch-tip-anchor';
  eccentricRod.add(leafSpring, leafSpringAnchor, leafSpringTipIndex);
  const frame = new THREE.Group();
  frame.userData.role = 'fixed-frame-and-valve-carrier-guide';
  const frameBeams = [];
  const valveGuideRail = new THREE.Group();
  valveGuideRail.userData.role = 'rear-horizontal-guide-for-valve-pin-carrier';
  frame.add(valveGuideRail);
  root.add(frame);
  // State markers are anchors only: the plate draws no contact dots.
  const camContactMarker = new THREE.Group();
  camContactMarker.userData.role = 'direct-cam-to-valve-pin-contact-anchor';
  const gabCaptureMarker = new THREE.Group();
  gabCaptureMarker.userData.role = 'gab-pin-capture-anchor';
  const latchMarker = new THREE.Group();
  latchMarker.userData.role = 'leaf-spring-notch-a-capture-anchor';
  const relievedCamMarker = new THREE.Group();
  relievedCamMarker.userData.role = 'relieved-cam-clear-of-valve-pin-anchor';
  root.add(
    camContactMarker,
    gabCaptureMarker,
    latchMarker,
    relievedCamMarker,
  );
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.4, 7.3, 3.2),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-2.00, 1.35, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    cameraEnvelope,
    camBackArm,
    camContactMarker,
    camLobe,
    camPivotPin,
    camWorkingRail,
    camWorkingEdge,
    eccentricRod,
    frame,
    frameBeams,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabCrownArch,
    gabJaws,
    gabTopBridge,
    handleIndex,
    handleStem,
    latchMarker,
    leafSpring,
    leafStrap,
    notchTab,
    rodBody,
    leafSpringAnchor,
    leafSpringTipIndex,
    loopCamHandle,
    loopGripAnchor,
    loopHandleBody,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    offFrameRodIndex,
    relievedCamMarker,
    rodLeftBody,
    rodMiddleBody,
    rodRightTail,
    valveCarrierTongue,
    valveCarrierWeb,
    valveGear,
    valveGuideRail,
    valvePin,
    valvePinAnchor,
    valvePinBoss,
    valvePinIndex,
  };

  const geometry = {
    camBackCrownLocal: camBackCrownLocal.clone(),
    camPivotLocal: camPivotLocal.clone(),
    camProfilePointsLocal: camProfilePointsLocal.map((point) => point.clone()),
    camProfileSampleCount,
    cyclePeriod,
    fullClearCouplingEnd,
    fullClearCouplingStart,
    gabInnerHalfWidth,
    gabJawWidth,
    gabMouthDepth,
    gabPinRadius,
    gabTopBridgeMaximumY,
    gabTopBridgeMinimumY,
    inputTurnsPerCycle,
    leafAnchorLocal: leafAnchorLocal.clone(),
    leafRestPathLocal: leafRestPathLocal.map((point) => point.clone()),
    leafRestTipLocal: leafRestTipLocal.clone(),
    loopGripLocal: loopGripLocal.clone(),
    maximumCamRelief,
    maximumGabLift,
    maximumHandleAngle,
    notchALocal: notchALocal.clone(),
    rodLeftEndLocal: rodLeftEndLocal.clone(),
    rodRightEndLocal: rodRightEndLocal.clone(),
    rodStroke,
    sequenceBreaks,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCamBackCrown: sourceRasterCamBackCrown.clone(),
    sourceRasterCamPivot: sourceRasterCamPivot.clone(),
    sourceRasterGabPin: sourceRasterGabPin.clone(),
    sourceRasterLeafAnchor: sourceRasterLeafAnchor.clone(),
    sourceRasterLeafFreeTip: sourceRasterLeafFreeTip.clone(),
    sourceRasterLoopGrip: sourceRasterLoopGrip.clone(),
    sourceRasterNotchA: sourceRasterNotchA.clone(),
    sourceRasterRodLeftEnd: sourceRasterRodLeftEnd.clone(),
    sourceRasterRodRightEnd: sourceRasterRodRightEnd.clone(),
    sourceUnitsPerPixel,
    springMaximumDeflection,
    workingCamEndAngle,
    workingHandleFraction,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveGear.position.set(state.valvePin.x, state.valvePin.y, -0.30);
    eccentricRod.position.set(state.gabCenter.x, state.gabCenter.y, 0.12);
    loopCamHandle.rotation.z = state.handleAngle;
    const springCurve = new THREE.CatmullRomCurve3(
      state.leafSpringPointsLocal,
      false,
      'centripetal',
    );
    leafStrap.userData.setPoints(springCurve.getSpacedPoints(leafStrapPoints - 1));
    leafSpringTipIndex.position.copy(state.leafSpringTipLocal);
    camContactMarker.position.set(
      state.pinSurfacePoint.x,
      state.pinSurfacePoint.y,
      1.02,
    );
    camContactMarker.visible = state.camContactActive;
    gabCaptureMarker.position.set(state.valvePin.x, state.valvePin.y, 1.22);
    gabCaptureMarker.visible = state.gabCaptured;
    latchMarker.position.set(state.notchA.x, state.notchA.y, 0.88);
    latchMarker.visible = state.latchEngagement > 1 - 1e-8;
    relievedCamMarker.position.set(
      state.camProfilePoint.x,
      state.camProfilePoint.y,
      0.92,
    );
    relievedCamMarker.visible = state.camRelievedForRodMotion;
    root.userData.contacts = {
      camPin: {
        active: state.camContactActive,
        intendedGap: state.camPinIntendedGap,
        minimumProfileGap: state.camProfileMinimumGap,
        point: state.pinSurfacePoint.clone(),
        relief: state.camProfileRelief,
      },
      gabPin: {
        captured: state.gabCaptured,
        clearance: state.minimumGabSolidClearance,
        fullyClear: state.pinFullyClearBelowGab,
        gabCenter: state.gabCenter.clone(),
        pin: state.valvePin.clone(),
      },
      notchA: {
        captureError: state.latchCaptureError,
        engagement: state.latchEngagement,
        gap: state.latchGap,
        point: state.notchA.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    camHalfLift: cyclePeriod * 0.28,
    fullLiftBeforeLatch: cyclePeriod * sequenceBreaks.camLiftEnd,
    handleOvertravelHalf: cyclePeriod * 0.37,
    latchedReleasedPositiveStroke: cyclePeriod * 0.46,
    leafFlexedForRelease: cyclePeriod * 0.67,
    camHalfLowered: cyclePeriod * 0.82,
    nextEngagedRunning: cyclePeriod * 0.94,
    sourceEngaged: 0,
  };
  const canonicalStates = {
    engagedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: Math.PI / 2,
    }),
    fullyLiftedAndLatched: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: 0,
      latchEngagement: 1,
    }),
    fullyLiftedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: Math.PI / 2,
      latchEngagement: 1,
    }),
    sourceEngaged: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 0,
    }),
    workingCamAtFullLift: stateAtConfiguration({
      handleFraction: workingHandleFraction,
      inputAngle: 0,
    }),
  };

  root.userData.archetype =
    'loop-handle-direct-pin-conjugate-cam-leaf-spring-notch-gab-release';
  root.userData.blocks = blocks;
  root.userData.camLawAtHandleAngle = camLawAtHandleAngle;
  root.userData.camProfileAtHandleAngle = camProfileAtHandleAngle;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.inputMotionAtCyclePhase = inputMotionAtCyclePhase;
  root.userData.leafSpringPointsAtConfiguration =
    leafSpringPointsAtConfiguration;
  root.userData.loopGripLocalAtHandleAngle = loopGripLocalAtHandleAngle;
  root.userData.mechanism =
    'rod-pivoted-loop-handle-conjugate-cam-lifts-gab-directly-from-valve-pin-then-leaf-spring-latches-notch-a-on-relieved-overtravel';
  root.userData.notchALocalAtHandleAngle = notchALocalAtHandleAngle;
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.sourceRasterFromPoint = sourceRasterFromPoint;
  root.userData.stateAtConfiguration = stateAtConfiguration;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.00;
  root.userData.fidelity = 'authored';

  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    camContactMarker,
    gabCaptureMarker,
    handleIndex,
    latchMarker,
    leafSpringTipIndex,
    offFrameRodIndex,
    relievedCamMarker,
    valvePinIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(4.2, 3.2, 15.4),
    root,
    update,
  };
}

function bellCrankHangerGabDisengager() {
  const root = new THREE.Group();

  // Brown gives 189 only as "another modification of 186." The plate itself
  // supplies the missing topology: a fixed operating-lever pivot carries a
  // short crank, that crank pulls a long hanger pinned to the right end of the
  // eccentric rod, and the rod rocks about its remote eccentric connection to
  // raise its gab off the valve-lever pin. These measured anchors all use the
  // center of the source gab pin as their common origin.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterGabPin = new THREE.Vector2(342, 401);
  const sourceRasterValvePivot = new THREE.Vector2(327, 282);
  const sourceRasterOperatingPivot = new THREE.Vector2(401, 235);
  const sourceRasterCrankPin = new THREE.Vector2(471, 235);
  const sourceRasterRodHangerPin = new THREE.Vector2(470, 401);
  const sourceRasterOperatingHandleTop = new THREE.Vector2(400, 28);
  const sourceRasterEccentricJoint = new THREE.Vector2(15, 399);
  const sourceRasterRodRightEnd = new THREE.Vector2(511, 407);
  const sourceUnitsPerPixel = 0.016;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterGabPin.x) * sourceUnitsPerPixel,
    (sourceRasterGabPin.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceRasterFromPoint = (point) => new THREE.Vector2(
    sourceRasterGabPin.x + point.x / sourceUnitsPerPixel,
    sourceRasterGabPin.y - point.y / sourceUnitsPerPixel,
  );

  const valvePivot = sourcePointFromRaster(sourceRasterValvePivot);
  const valvePinLocal = valvePivot.clone().multiplyScalar(-1);
  const valveArmLength = valvePinLocal.length();
  const operatingPivot = sourcePointFromRaster(
    sourceRasterOperatingPivot,
  );
  const sourceCrankPin = sourcePointFromRaster(sourceRasterCrankPin);
  const operatingCrankLocal = sourceCrankPin.clone().sub(operatingPivot);
  const operatingHandleTopLocal = sourcePointFromRaster(
    sourceRasterOperatingHandleTop,
  ).sub(operatingPivot);
  const rodHangerPinLocal = sourcePointFromRaster(
    sourceRasterRodHangerPin,
  );
  const eccentricJointLocal = sourcePointFromRaster(
    sourceRasterEccentricJoint,
  );
  const rodRightEndLocal = sourcePointFromRaster(sourceRasterRodRightEnd);
  const rodHangerFromEccentricLocal = rodHangerPinLocal.clone().sub(
    eccentricJointLocal,
  );
  const operatingCrankLength = operatingCrankLocal.length();
  const hangerLength = sourceCrankPin.distanceTo(rodHangerPinLocal);
  const gabToRodHangerLength = rodHangerPinLocal.length();
  const eccentricToRodHangerLength = rodHangerFromEccentricLocal.length();
  const eccentricToGabLength = eccentricJointLocal.length();

  const valveRockerAmplitude = 0.12;
  const maximumOperatingAngle = 1.02;
  const gabPinRadius = 0.20;
  const gabInnerHalfWidth = gabPinRadius + 0.07;
  const gabJawWidth = 0.18;
  // Plate: the rod's lower edge is 15 pixels below the pin center and its
  // raised crown 48 pixels above it.
  const gabMouthDepth = 0.24;
  const gabTopBridgeMinimumY = 0.23;
  const gabTopBridgeMaximumY = 0.77;
  const fullClearCouplingStart = 0.54;
  const fullClearCouplingEnd = 0.62;

  const circleIntersectionNear = (
    firstCenter,
    firstRadius,
    secondCenter,
    secondRadius,
    preferred,
  ) => {
    const centerVector = secondCenter.clone().sub(firstCenter);
    const centerDistance = centerVector.length();
    if (
      centerDistance <= 1e-12
        || centerDistance > firstRadius + secondRadius + 1e-10
        || centerDistance < Math.abs(firstRadius - secondRadius) - 1e-10
    ) {
      throw new RangeError(
        'Movement 189 four-bar has no real assembly at this configuration.',
      );
    }
    const along = (
      firstRadius ** 2
        - secondRadius ** 2
        + centerDistance ** 2
    ) / (2 * centerDistance);
    const heightSquared = Math.max(0, firstRadius ** 2 - along ** 2);
    const height = Math.sqrt(heightSquared);
    const unit = centerVector.divideScalar(centerDistance);
    const base = firstCenter.clone().addScaledVector(unit, along);
    const perpendicular = new THREE.Vector2(-unit.y, unit.x);
    const candidates = [
      base.clone().addScaledVector(perpendicular, height),
      base.clone().addScaledVector(perpendicular, -height),
    ];
    return candidates[0].distanceToSquared(preferred)
      <= candidates[1].distanceToSquared(preferred)
      ? candidates[0]
      : candidates[1];
  };

  const nominalEngagedPoseAtInputAngle = (inputAngle) => {
    const resolvedInputAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const nominalRockerAngle = valveRockerAmplitude
      * Math.sin(resolvedInputAngle);
    const nominalValvePin = pointInPose(
      valvePivot,
      nominalRockerAngle,
      valvePinLocal,
    );
    const preferredHangerPin = rodHangerPinLocal.clone().add(
      nominalValvePin,
    );
    const rodHangerPin = circleIntersectionNear(
      nominalValvePin,
      gabToRodHangerLength,
      sourceCrankPin,
      hangerLength,
      preferredHangerPin,
    );
    const rodAngle = Math.atan2(
      rodHangerPin.y - nominalValvePin.y,
      rodHangerPin.x - nominalValvePin.x,
    ) - Math.atan2(rodHangerPinLocal.y, rodHangerPinLocal.x);
    const eccentricJoint = nominalValvePin.clone().add(
      rotate2(rodAngle, eccentricJointLocal),
    );
    return {
      eccentricJoint,
      nominalRockerAngle,
      nominalValvePin,
      resolvedInputAngle,
      rodAngle,
      rodHangerPin,
    };
  };

  const rodPoseAtConfiguration = ({ handleFraction, inputAngle }) => {
    const resolvedHandleFraction = THREE.MathUtils.clamp(
      handleFraction,
      0,
      1,
    );
    const operatingAngle = maximumOperatingAngle
      * resolvedHandleFraction;
    const nominal = nominalEngagedPoseAtInputAngle(inputAngle);
    const crankPin = operatingPivot.clone().add(
      rotate2(operatingAngle, operatingCrankLocal),
    );
    const preferredHangerPin = nominal.rodHangerPin.clone().add(
      crankPin.clone().sub(sourceCrankPin),
    );
    const rodHangerPin = circleIntersectionNear(
      nominal.eccentricJoint,
      eccentricToRodHangerLength,
      crankPin,
      hangerLength,
      preferredHangerPin,
    );
    const rodAngle = Math.atan2(
      rodHangerPin.y - nominal.eccentricJoint.y,
      rodHangerPin.x - nominal.eccentricJoint.x,
    ) - Math.atan2(
      rodHangerFromEccentricLocal.y,
      rodHangerFromEccentricLocal.x,
    );
    const gabCenter = nominal.eccentricJoint.clone().add(
      rotate2(
        rodAngle,
        eccentricJointLocal.clone().multiplyScalar(-1),
      ),
    );
    const operatingHandleTop = operatingPivot.clone().add(
      rotate2(operatingAngle, operatingHandleTopLocal),
    );
    return {
      crankPin,
      eccentricJoint: nominal.eccentricJoint.clone(),
      gabCenter,
      nominal,
      operatingAngle,
      operatingHandleTop,
      resolvedHandleFraction,
      rodAngle,
      rodHangerPin,
    };
  };

  const maximumLiftAuditSamples = 4096;
  let minimumFullyRaisedGabLift = Infinity;
  for (let index = 0; index <= maximumLiftAuditSamples; index += 1) {
    const inputAngle = FULL_TURN * index / maximumLiftAuditSamples;
    const pose = rodPoseAtConfiguration({ handleFraction: 1, inputAngle });
    const lift = pose.gabCenter.y - pose.nominal.nominalValvePin.y;
    minimumFullyRaisedGabLift = Math.min(
      minimumFullyRaisedGabLift,
      lift,
    );
  }
  if (minimumFullyRaisedGabLift <= fullClearCouplingEnd) {
    throw new RangeError(
      'Movement 189 hanger cannot lift the gab clear of its pin.',
    );
  }

  const cyclePeriod = 18;
  const inputTurnsPerCycle = 6;
  const sequenceBreaks = Object.freeze({
    engagedRunEnd: 0.18,
    handleLiftStart: 0.22,
    handleLiftEnd: 0.36,
    releasedRunEnd: 0.64,
    handleLowerStart: 0.68,
    handleLowerEnd: 0.82,
  });

  const inputMotionAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let turns = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 2,
    };
    if (phase < sequenceBreaks.engagedRunEnd) {
      turns = transitionLaw(
        phase,
        0,
        sequenceBreaks.engagedRunEnd,
        0,
        2,
      );
    } else if (phase < sequenceBreaks.handleLiftEnd) {
      turns.value = 2;
    } else if (phase < sequenceBreaks.releasedRunEnd) {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLiftEnd,
        sequenceBreaks.releasedRunEnd,
        2,
        4,
      );
    } else if (phase < sequenceBreaks.handleLowerEnd) {
      turns.value = 4;
    } else {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLowerEnd,
        1,
        4,
        inputTurnsPerCycle,
      );
    }
    return {
      accelerationPerPhaseSquared:
        FULL_TURN * turns.accelerationPerPhaseSquared,
      angle: FULL_TURN * turns.value,
      phase,
      ratePerPhase: FULL_TURN * turns.ratePerPhase,
      turns: turns.value,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let handle = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.handleLiftStart
        && phase < sequenceBreaks.handleLiftEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleLiftStart,
        sequenceBreaks.handleLiftEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handleLiftEnd
        && phase < sequenceBreaks.handleLowerStart
    ) {
      handle.value = 1;
    } else if (
      phase >= sequenceBreaks.handleLowerStart
        && phase < sequenceBreaks.handleLowerEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleLowerStart,
        sequenceBreaks.handleLowerEnd,
        1,
        0,
      );
    }

    let stage = 'engaged-eccentric-rod-driving-valve-gear';
    if (
      phase >= sequenceBreaks.engagedRunEnd
        && phase < sequenceBreaks.handleLiftStart
    ) stage = 'eccentric-stopped-at-gab-release-alignment';
    else if (
      phase >= sequenceBreaks.handleLiftStart
        && phase < sequenceBreaks.handleLiftEnd
    ) stage = 'operating-lever-and-hanger-lifting-gab';
    else if (
      phase >= sequenceBreaks.handleLiftEnd
        && phase < sequenceBreaks.releasedRunEnd
    ) stage = 'operator-holding-gab-clear-while-eccentric-runs';
    else if (
      phase >= sequenceBreaks.releasedRunEnd
        && phase < sequenceBreaks.handleLowerStart
    ) stage = 'eccentric-stopped-with-gab-held-clear';
    else if (
      phase >= sequenceBreaks.handleLowerStart
        && phase < sequenceBreaks.handleLowerEnd
    ) stage = 'operating-lever-lowering-gab-to-recapture-pin';
    else if (phase >= sequenceBreaks.handleLowerEnd) {
      stage = 'gab-recaptured-eccentric-rod-driving-valve-gear';
    }
    return {
      handleAccelerationPerPhaseSquared:
        handle.accelerationPerPhaseSquared,
      handleFraction: handle.value,
      handleRatePerPhase: handle.ratePerPhase,
      phase,
      stage,
    };
  };

  const stateAtConfiguration = ({
    handleAcceleration = 0,
    handleAngularVelocity = 0,
    handleFraction = 0,
    inputAngle = 0,
  }) => {
    const pose = rodPoseAtConfiguration({ handleFraction, inputAngle });
    const gabLift = pose.gabCenter.y
      - pose.nominal.nominalValvePin.y;
    const clearNormalized = THREE.MathUtils.clamp(
      (gabLift - fullClearCouplingStart)
        / (fullClearCouplingEnd - fullClearCouplingStart),
      0,
      1,
    );
    const couplingBlend = 1 - smootherstepLaw(clearNormalized).value;
    const rockerAngle = pose.nominal.nominalRockerAngle * couplingBlend;
    const valvePin = pointInPose(
      valvePivot,
      rockerAngle,
      valvePinLocal,
    );
    const pinRelativeWorld = valvePin.clone().sub(pose.gabCenter);
    const pinRelativeToGab = rotate2(-pose.rodAngle, pinRelativeWorld);

    const jawMinimumY = -gabMouthDepth;
    const jawMaximumY = gabTopBridgeMaximumY;
    const leftJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(
        -gabInnerHalfWidth - gabJawWidth,
        jawMinimumY,
      ),
      new THREE.Vector2(-gabInnerHalfWidth, jawMaximumY),
    ) - gabPinRadius;
    const rightJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(gabInnerHalfWidth, jawMinimumY),
      new THREE.Vector2(
        gabInnerHalfWidth + gabJawWidth,
        jawMaximumY,
      ),
    ) - gabPinRadius;
    const topBridgeClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(
        -gabInnerHalfWidth,
        gabTopBridgeMinimumY,
      ),
      new THREE.Vector2(
        gabInnerHalfWidth,
        gabTopBridgeMaximumY,
      ),
    ) - gabPinRadius;
    const minimumGabSolidClearance = Math.min(
      leftJawClearance,
      rightJawClearance,
      topBridgeClearance,
    );
    const pinInsideGabMouth = (
      Math.abs(pinRelativeToGab.x) + gabPinRadius
        <= gabInnerHalfWidth + 1e-10
        && pinRelativeToGab.y - gabPinRadius
          >= -gabMouthDepth - 1e-10
        && pinRelativeToGab.y + gabPinRadius
          <= gabTopBridgeMinimumY + 1e-10
    );
    const pinFullyClearBelowGab = pinRelativeToGab.y + gabPinRadius
      < -gabMouthDepth;
    const gabCaptured = (
      pose.resolvedHandleFraction <= 1e-12
        && pose.gabCenter.distanceTo(valvePin) <= 1e-10
        && couplingBlend >= 1 - 1e-12
    );
    const rodRightEnd = pose.gabCenter.clone().add(
      rotate2(pose.rodAngle, rodRightEndLocal),
    );
    const crankLengthError = Math.abs(
      pose.crankPin.distanceTo(operatingPivot) - operatingCrankLength,
    );
    const hangerLengthError = Math.abs(
      pose.crankPin.distanceTo(pose.rodHangerPin) - hangerLength,
    );
    const eccentricToHangerLengthError = Math.abs(
      pose.eccentricJoint.distanceTo(pose.rodHangerPin)
        - eccentricToRodHangerLength,
    );
    const eccentricToGabLengthError = Math.abs(
      pose.eccentricJoint.distanceTo(pose.gabCenter)
        - eccentricToGabLength,
    );
    const gabToHangerLengthError = Math.abs(
      pose.gabCenter.distanceTo(pose.rodHangerPin)
        - gabToRodHangerLength,
    );

    return {
      couplingBlend,
      crankLengthError,
      crankPin: pose.crankPin,
      eccentricJoint: pose.eccentricJoint,
      eccentricToGabLengthError,
      eccentricToHangerLengthError,
      gabCaptured,
      gabCenter: pose.gabCenter,
      gabLift,
      gabToHangerLengthError,
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: pose.resolvedHandleFraction,
      hangerLengthError,
      inputAngle: pose.nominal.resolvedInputAngle,
      minimumGabSolidClearance,
      nominalRockerAngle: pose.nominal.nominalRockerAngle,
      nominalValvePin: pose.nominal.nominalValvePin,
      operatingAngle: pose.operatingAngle,
      operatingHandleTop: pose.operatingHandleTop,
      pinFullyClearBelowGab,
      pinInsideGabMouth,
      pinRelativeToGab,
      rockerAngle,
      rodAngle: pose.rodAngle,
      rodHangerPin: pose.rodHangerPin,
      rodRightEnd,
      valvePin,
      valvePinRadiusError: Math.abs(
        valvePin.distanceTo(valvePivot) - valveArmLength
      ),
      valvePivot: valvePivot.clone(),
    };
  };

  const stateAtInputAngle = (inputAngle, handleFraction = 0) => (
    stateAtConfiguration({ handleFraction, inputAngle })
  );
  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const input = inputMotionAtCyclePhase(sequence.phase);
    const phaseRate = 1 / cyclePeriod;
    const handleAngularVelocity = maximumOperatingAngle
      * sequence.handleRatePerPhase
      * phaseRate;
    const handleAcceleration = maximumOperatingAngle
      * sequence.handleAccelerationPerPhaseSquared
      * phaseRate ** 2;
    const state = stateAtConfiguration({
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: sequence.handleFraction,
      inputAngle: input.angle,
    });
    state.cyclePhase = sequence.phase;
    state.inputAngularAcceleration = input.accelerationPerPhaseSquared
      * phaseRate ** 2;
    state.inputAngularSpeed = input.ratePerPhase * phaseRate;
    state.inputTurns = input.turns;
    state.stage = sequence.stage;
    return state;
  };
  const stateAtTime = (time) => {
    const state = stateAtCyclePhase(time / cyclePeriod);
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  // Source-traced bodies (0.016 units per plate pixel). Front to back: the
  // bell crank, the rod with its crown, fork and tail, the hanging link (the
  // plate draws both eyes whole over its ends) and the valve lever. Pins end
  // at the faces they join.
  const rodFromRaster = (point) => sourcePointFromRaster(point);
  const valveRocker = new THREE.Group();
  valveRocker.position.set(valvePivot.x, valvePivot.y, -0.32);
  valveRocker.userData.axis = Z_AXIS.clone();
  valveRocker.userData.role =
    'fixed-axis-valve-gab-lever-carrying-the-engagement-pin';
  // The shaft and boss end behind the rod, which rocks up past them.
  const valveShaft = cylinderAlongZ(0.36, 1.11, darkMaterial, 40);
  valveShaft.position.z = -0.255;
  valveShaft.userData.role = 'fixed-valve-rockshaft';
  const valveShaftFace = boredBoss(0.58, 0.23, 0.372, drivenMaterial);
  valveShaftFace.position.z = -0.035;
  valveShaftFace.userData.role = 'source-hatched-valve-rockshaft-boss';
  const valveArm = boredGabLever(valvePinLocal, {
    startRadius: 0.58, endRadius: 0.58,
    startBore: 0.372, endBore: gabPinRadius + .012, depth: 0.34, width: 0.72,
  }, drivenMaterial);
  valveArm.userData.role = 'rigid-valve-lever-from-rockshaft-to-gab-pin';
  const valvePin = cylinderAlongZ(gabPinRadius, 0.73, brassMaterial, 34);
  valvePin.position.set(valvePinLocal.x, valvePinLocal.y, 0.195);
  valvePin.userData.role = 'valve-gear-pin-captured-by-eccentric-rod-gab';
  const valvePinIndex = new THREE.Group();
  valvePinIndex.position.set(valvePinLocal.x, valvePinLocal.y, 0.56);
  valvePinIndex.userData.role = 'valve-gear-pin-face-anchor';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.position.set(valvePinLocal.x, valvePinLocal.y, 0);
  valvePinAnchor.userData.role = 'exact-valve-pin-center-anchor';
  const valveShaftIndex = new THREE.Group();
  valveShaftIndex.userData.role = 'valve-rockshaft-angle-anchor';
  valveRocker.add(
    valveArm,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  );
  root.add(valveRocker);

  const eccentricRod = new THREE.Group();
  eccentricRod.position.z = 0.10;
  eccentricRod.userData.role =
    'rigid-eccentric-rod-with-downward-gab-and-hanger-pin';
  // One plate: forked left end, bar (y 383-416), raised crown, the lower
  // tail to the right end, its hanger eye, and the gab slot.
  const rodBarBottom = -gabMouthDepth;
  const rodBottomRaster = sourceRasterGabPin.y + gabMouthDepth / sourceUnitsPerPixel;
  const rodBody = sourcePlate([
    [[12, 383], [290, 383], [301, 376], [318, 358], [340, 353], [360, 359],
      [378, 372], [388, 387], [398, 398], [512, 403], [518, 409], [512, rodBottomRaster],
      [12, rodBottomRaster]],
    poly(circle(rodHangerPinLocal.toArray(), .22, 48)),
  ], rodFromRaster, -0.11, 0.11, driverMaterial, [
    poly([[-gabInnerHalfWidth, rodBarBottom - .1], [gabInnerHalfWidth, rodBarBottom - .1],
      [gabInnerHalfWidth, gabTopBridgeMinimumY], [-gabInnerHalfWidth, gabTopBridgeMinimumY]]),
    poly(circle(rodHangerPinLocal.toArray(), .132, 48)),
    // The slot between the forked end's two prongs.
    poly([[5, 392], [118, 392], [118, 406], [5, 406]].map(([x, y]) => {
      const local = rodFromRaster(new THREE.Vector2(x, y));
      return [local.x, local.y];
    })),
  ]);
  rodBody.userData.role = 'eccentric-rod-with-fork-crown-gab-slot-and-tail';
  const rodLeftBody = rodBody;
  const leftForkProngs = [-1, 1].map((sign) => {
    const prong = new THREE.Group();
    prong.userData.role = `${sign < 0 ? 'lower' : 'upper'}-off-frame-eccentric-fork-prong-anchor`;
    return prong;
  });
  const rodRightTail = rodBody;
  const gabTopBridge = rodBody;
  const gabCrownArch = rodBody;
  const gabJaws = [-1, 1].map((sign) => {
    const jaw = new THREE.Group();
    jaw.position.set(sign * (gabInnerHalfWidth + gabJawWidth / 2), 0, 0);
    jaw.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-jaw-of-rod-bar`;
    eccentricRod.add(jaw);
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((sign) => {
    const face = new THREE.Group();
    face.position.set(sign * gabInnerHalfWidth, 0, 0);
    face.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-slot-face`;
    eccentricRod.add(face);
    return face;
  });
  const rodHangerBoss = boredBoss(0.22, 0.22, .132, driverMaterial);
  rodHangerBoss.position.set(rodHangerPinLocal.x, rodHangerPinLocal.y, 0);
  rodHangerBoss.userData.role = 'source-eye-around-rod-hanger-pin';
  const rodHangerPin = cylinderAlongZ(0.12, 0.51, darkMaterial, 30);
  rodHangerPin.position.set(rodHangerPinLocal.x, rodHangerPinLocal.y, -0.145);
  rodHangerPin.userData.role = 'through-pin-joining-hanger-to-eccentric-rod';
  const rodHangerPinAnchor = new THREE.Group();
  rodHangerPinAnchor.position.set(
    rodHangerPinLocal.x,
    rodHangerPinLocal.y,
    0,
  );
  rodHangerPinAnchor.userData.role = 'exact-center-of-rod-hanger-pin';
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.userData.role = 'exact-center-of-eccentric-rod-gab';
  const eccentricJointAnchor = new THREE.Group();
  eccentricJointAnchor.position.set(
    eccentricJointLocal.x,
    eccentricJointLocal.y,
    0,
  );
  eccentricJointAnchor.userData.role =
    'exact-remote-eccentric-connection-of-rigid-rod';
  const rodIndex = new THREE.Group();
  rodIndex.userData.role = 'eccentric-rod-stroke-anchor';
  eccentricRod.add(
    eccentricJointAnchor,
    gabCenterAnchor,
    ...leftForkProngs,
    rodHangerBoss,
    rodHangerPin,
    rodHangerPinAnchor,
    rodIndex,
    rodBody,
  );
  root.add(eccentricRod);

  const operatingLever = new THREE.Group();
  operatingLever.position.set(operatingPivot.x, operatingPivot.y, 0.52);
  operatingLever.userData.axis = Z_AXIS.clone();
  operatingLever.userData.role =
    'single-rigid-operating-handle-and-short-lifting-crank';
  const operatingHandleStem = boredGabLever(operatingHandleTopLocal, {
    startRadius: .32, endRadius: .10, startBore: .162, endBore: 0, depth: .16, width: .21,
  }, accentMaterial);
  operatingHandleStem.userData.role = 'source-long-upright-operating-handle';
  const operatingCrankArm = boredGabLever(operatingCrankLocal, {
    startRadius: .32, endRadius: .22, startBore: .162, endBore: .132, depth: .16, width: .14,
  }, accentMaterial);
  operatingCrankArm.userData.role =
    'source-short-crank-rigid-with-operating-handle';
  const crankPin = cylinderAlongZ(0.12, 0.90, darkMaterial, 30);
  crankPin.position.set(
    operatingCrankLocal.x,
    operatingCrankLocal.y,
    -0.37,
  );
  crankPin.userData.role = 'through-pin-joining-short-crank-to-hanger';
  const crankPinAnchor = new THREE.Group();
  crankPinAnchor.position.set(
    operatingCrankLocal.x,
    operatingCrankLocal.y,
    0,
  );
  crankPinAnchor.userData.role = 'exact-center-of-short-crank-pin';
  const operatingHandleTopAnchor = new THREE.Group();
  operatingHandleTopAnchor.position.set(
    operatingHandleTopLocal.x,
    operatingHandleTopLocal.y,
    0,
  );
  operatingHandleTopAnchor.userData.role =
    'source-top-center-of-operating-handle';
  const handleIndex = new THREE.Group();
  handleIndex.userData.role = 'operating-handle-angle-anchor';
  operatingLever.add(
    crankPin,
    crankPinAnchor,
    handleIndex,
    operatingCrankArm,
    operatingHandleStem,
    operatingHandleTopAnchor,
  );
  root.add(operatingLever);

  const operatingPivotPin = cylinderAlongZ(0.15, 0.87, darkMaterial, 34);
  operatingPivotPin.position.set(
    operatingPivot.x,
    operatingPivot.y,
    0.185,
  );
  operatingPivotPin.userData.role = 'fixed-pivot-of-operating-bell-crank';
  const operatingPivotFace = boredBoss(.31, .16, .162, accentMaterial);
  operatingPivotFace.position.set(
    operatingPivot.x,
    operatingPivot.y,
    0.33,
  );
  operatingPivotFace.userData.role = 'source-round-operating-pivot-boss';
  const operatingPivotAnchor = new THREE.Group();
  operatingPivotAnchor.position.set(operatingPivot.x, operatingPivot.y, 0);
  operatingPivotAnchor.userData.role = 'exact-fixed-operating-pivot-center';
  root.add(operatingPivotAnchor, operatingPivotFace, operatingPivotPin);

  const hangerLink = makeBoredPlanarLink({
    length: hangerLength, width: .22, eyeRadius: .22, boreRadius: .132, depth: .16,
  }, brassMaterial);
  hangerLink.userData.role =
    'single-finite-hanger-link-between-crank-and-eccentric-rod';
  root.add(hangerLink);

  const frame = new THREE.Group();
  frame.position.z = -0.92;
  frame.userData.role = 'fixed-support-frame-behind-source-linkage';
  const frameBeams = [
    [new THREE.Vector3(-5.72, -1.14, 0), new THREE.Vector3(3.14, -1.14, 0)],
    [new THREE.Vector3(-0.86, -1.14, 0), new THREE.Vector3(-0.38, 1.87, 0)],
    [new THREE.Vector3(1.48, -1.14, 0), new THREE.Vector3(1.08, 2.61, 0)],
  ].map(([start, end], index) => {
    const beam = makeBeam(start, end, {
      color: PALETTE.frame,
      depth: 0.20,
      jointRadius: 0.001,
      thickness: 0.12,
    });
    beam.userData.role = `fixed-frame-member-${index + 1}`;
    frame.add(beam);
    return beam;
  });
  const frameValveBearing = boredBoss(0.46, 0.22, .372, frameMaterial);
  frameValveBearing.position.set(valvePivot.x, valvePivot.y, 0.10);
  frameValveBearing.userData.role = 'rear-valve-rockshaft-frame-bearing';
  const frameOperatingBearing = boredBoss(.36, .22, .162, frameMaterial);
  frameOperatingBearing.position.set(
    operatingPivot.x,
    operatingPivot.y,
    0.10,
  );
  frameOperatingBearing.userData.role = 'rear-operating-pivot-frame-bearing';
  frame.add(frameOperatingBearing, frameValveBearing);
  root.add(frame);

  // State markers are anchors only: the plate draws no contact dots.
  const gabCaptureMarker = new THREE.Group();
  gabCaptureMarker.userData.role = 'gab-pin-capture-anchor';
  const fullClearMarker = new THREE.Group();
  fullClearMarker.userData.role = 'gab-fully-clear-of-valve-pin-anchor';
  root.add(fullClearMarker, gabCaptureMarker);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 8.0, 3.4),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-1.30, 2.05, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    cameraEnvelope,
    crankPin,
    crankPinAnchor,
    eccentricJointAnchor,
    eccentricRod,
    frame,
    frameBeams,
    frameOperatingBearing,
    frameValveBearing,
    fullClearMarker,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabCrownArch,
    gabJaws,
    gabTopBridge,
    handleIndex,
    hangerLink,
    leftForkProngs,
    operatingCrankArm,
    operatingHandleStem,
    operatingHandleTopAnchor,
    operatingLever,
    operatingPivotAnchor,
    operatingPivotFace,
    operatingPivotPin,
    rodHangerBoss,
    rodHangerPin,
    rodHangerPinAnchor,
    rodIndex,
    rodBody,
    rodLeftBody,
    rodRightTail,
    valveArm,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveRocker,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  };

  const geometry = {
    cyclePeriod,
    eccentricJointLocal: eccentricJointLocal.clone(),
    eccentricToGabLength,
    eccentricToRodHangerLength,
    fullClearCouplingEnd,
    fullClearCouplingStart,
    gabInnerHalfWidth,
    gabJawWidth,
    gabMouthDepth,
    gabPinRadius,
    gabToRodHangerLength,
    gabTopBridgeMaximumY,
    gabTopBridgeMinimumY,
    hangerLength,
    inputTurnsPerCycle,
    maximumOperatingAngle,
    minimumFullyRaisedGabLift,
    operatingCrankLength,
    operatingCrankLocal: operatingCrankLocal.clone(),
    operatingHandleTopLocal: operatingHandleTopLocal.clone(),
    operatingPivot: operatingPivot.clone(),
    rodHangerPinLocal: rodHangerPinLocal.clone(),
    rodRightEndLocal: rodRightEndLocal.clone(),
    sequenceBreaks,
    sourceCrankPin: sourceCrankPin.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCrankPin: sourceRasterCrankPin.clone(),
    sourceRasterEccentricJoint: sourceRasterEccentricJoint.clone(),
    sourceRasterGabPin: sourceRasterGabPin.clone(),
    sourceRasterOperatingHandleTop:
      sourceRasterOperatingHandleTop.clone(),
    sourceRasterOperatingPivot: sourceRasterOperatingPivot.clone(),
    sourceRasterRodHangerPin: sourceRasterRodHangerPin.clone(),
    sourceRasterRodRightEnd: sourceRasterRodRightEnd.clone(),
    sourceRasterValvePivot: sourceRasterValvePivot.clone(),
    sourceUnitsPerPixel,
    valveArmLength,
    valvePivot: valvePivot.clone(),
    valveRockerAmplitude,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveRocker.rotation.z = state.rockerAngle;
    eccentricRod.position.set(
      state.gabCenter.x,
      state.gabCenter.y,
      0.10,
    );
    eccentricRod.rotation.z = state.rodAngle;
    operatingLever.rotation.z = state.operatingAngle;
    hangerLink.userData.setEndpoints(
      new THREE.Vector3(state.crankPin.x, state.crankPin.y, -0.22),
      new THREE.Vector3(
        state.rodHangerPin.x,
        state.rodHangerPin.y,
        -0.22,
      ),
    );
    gabCaptureMarker.position.set(
      state.valvePin.x,
      state.valvePin.y,
      1.30,
    );
    gabCaptureMarker.visible = state.gabCaptured;
    fullClearMarker.position.set(
      state.valvePin.x,
      state.valvePin.y,
      1.24,
    );
    fullClearMarker.visible = state.pinFullyClearBelowGab;
    root.userData.contacts = {
      gabPin: {
        captured: state.gabCaptured,
        clearance: state.minimumGabSolidClearance,
        fullyClear: state.pinFullyClearBelowGab,
        gabCenter: state.gabCenter.clone(),
        pin: state.valvePin.clone(),
      },
      hanger: {
        crankError: state.crankLengthError,
        eccentricRodError: state.eccentricToHangerLengthError,
        lengthError: state.hangerLengthError,
        lowerPin: state.rodHangerPin.clone(),
        upperPin: state.crankPin.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    engagedRunning: cyclePeriod * 0.10,
    handleHalfRaised: cyclePeriod * 0.29,
    heldClearPositiveStroke: cyclePeriod * 0.43,
    heldClearStopped: cyclePeriod * 0.66,
    handleHalfLowered: cyclePeriod * 0.75,
    nextEngagedRunning: cyclePeriod * 0.91,
    sourceEngaged: 0,
  };
  const canonicalStates = {
    engagedAtNegativeStroke: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 3 * Math.PI / 2,
    }),
    engagedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: Math.PI / 2,
    }),
    fullyRaisedAtNegativeStroke: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: 3 * Math.PI / 2,
    }),
    fullyRaisedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: Math.PI / 2,
    }),
    sourceEngaged: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 0,
    }),
  };

  root.userData.archetype =
    'bell-crank-hanger-lifted-eccentric-rod-gab-pin-release';
  root.userData.blocks = blocks;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.inputMotionAtCyclePhase = inputMotionAtCyclePhase;
  root.userData.mechanism =
    'fixed-pivot-operating-handle-short-crank-and-finite-hanger-rock-the-eccentric-rod-to-lift-its-gab-from-the-valve-pin';
  root.userData.nominalEngagedPoseAtInputAngle =
    nominalEngagedPoseAtInputAngle;
  root.userData.rodPoseAtConfiguration = rodPoseAtConfiguration;
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.sourceRasterFromPoint = sourceRasterFromPoint;
  root.userData.stateAtConfiguration = stateAtConfiguration;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.00;
  root.userData.fidelity = 'authored';

  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    fullClearMarker,
    gabCaptureMarker,
    handleIndex,
    rodIndex,
    valvePinIndex,
    valveShaftIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(4.4, 3.4, 15.6),
    root,
    update,
  };
}

export function createAuthoredGabDisengagerMovement(movement) {
  const factory = {
    186: springHandleGabDisengager,
    187: twoHandleGabDisengager,
    188: loopHandlePinCamGabDisengager,
    189: bellCrankHangerGabDisengager,
  }[movement.id];
  if (!factory) return null;
  const model = factory();
  model.root.userData.hideGround = true;
  model.root.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) material.fog = false;
    }
  });
  return model;
}
