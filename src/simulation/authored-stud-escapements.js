import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { capsule, plate, polygonClipping } from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 30) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function boredCylinderAlongZ(radius, length, boreRadius, material, segments = 30) {
  const cylinder = new THREE.Mesh(
    boredLatheGeometry([
      { axial: -length / 2, radial: radius },
      { axial: length / 2, radial: radius },
    ], boreRadius, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 10,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function crossZ(point) {
  return new THREE.Vector2(-point.y, point.x);
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

function annularShape(outerRadius, innerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const opening = new THREE.Path();
  opening.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(opening);
  return shape;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function edgeTube(points, z, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
    false,
    'centripetal',
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 54, radius, 8, false),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function lePautePinConvexHull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1])
    - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2
      && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2
      && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function lePautePinSegmentDistance(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? THREE.MathUtils.clamp(
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared,
      0,
      1,
    )
    : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}

function lePautePinPointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Signed distance from a point to a polygon-clipping multipolygon:
// negative inside material, positive outside.
function lePautePinSignedDistance(point, multiPolygon) {
  let distance = Infinity;
  let inside = false;
  for (const polygon of multiPolygon) {
    polygon.forEach((ring, ringIndex) => {
      for (let index = 0; index + 1 < ring.length; index += 1) {
        distance = Math.min(distance,
          lePautePinSegmentDistance(point, ring[index], ring[index + 1]));
      }
      if (lePautePinPointInRing(point, ring)) {
        inside = ringIndex === 0 ? true : false;
      }
    });
  }
  return inside ? -distance : distance;
}

function lePautePinWheelEscapement(movement) {
  const root = new THREE.Group();

  // Brown's plate compares the original half-round A pin with the improved
  // thin B slip, whose curved leading side is the arc the pallets touch. Every pin projects from one
  // face of one wheel and both pallet bits work in that same plane. A broad
  // plate hangs from the round collet on the pallet arbor in front of the pin
  // ends; its right leg carries the higher outer pallet (tip pointing left,
  // outside the pin circle) and its left leg the lower inner pallet (tip
  // pointing right, inside the pin circle). A pin is held on the outer
  // pallet, passes to the inner pallet on the following beat, and the
  // succeeding pin then reaches the outer pallet. Resting faces are circular
  // about the pallet arbor (true deadbeat); every other pallet surface is the
  // backing region with the finite swept pin outlines removed.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(190, 333);
  const sourceRasterWheelOuterRadius = 171;
  const sourceRasterWheelInnerRadius = 129;
  const sourceRasterPinOrbitRadius = 149;
  const sourceRasterWheelBounds = Object.freeze({
    bottom: 506,
    left: 19,
    right: 385,
    top: 164,
  });
  const sourceRasterPalletPivot = new THREE.Vector2(359, 101);
  const sourceRasterColletRadius = 72;
  const sourceRasterOuterPalletTip = new THREE.Vector2(352, 352);
  const sourceRasterInnerPalletTip = new THREE.Vector2(340, 386);
  const sourceRasterLegacyPinA = new THREE.Vector2(47, 318);
  const sourceRasterPreferredPinB = new THREE.Vector2(321, 429);
  const sourceRasterHubBoltCircleRadius = 31;
  const sourceRasterHubRadius = 45;
  const sourceRasterDirection = 'clockwise, corroborated by the period construction drawing';
  const sourceScale = 3 / sourceRasterWheelOuterRadius;
  const wheelCenter = new THREE.Vector2(0, 0);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const palletPivot = sourcePointToModel(sourceRasterPalletPivot);

  const direction = -1;
  // Positive pallet angles swing the pallet feet to the right. The outer
  // pallet comes from the right, so it locks while the feet swing left.
  const palletSense = -1;
  const pinCount = 30;
  const pinPitch = FULL_TURN / pinCount;
  const halfPinPitch = pinPitch / 2;
  const wheelOuterRadius = sourceRasterWheelOuterRadius * sourceScale;
  const wheelInnerRadius = sourceRasterWheelInnerRadius * sourceScale;
  const pinOrbitRadius = sourceRasterPinOrbitRadius * sourceScale;
  const wheelDepth = 0.34;
  // The pins stand out of the wheel face about the rim's own thickness, just
  // enough for the pallet bits to work them.
  const pinLength = 0.34;
  const palletDepth = 0.20;
  const workingPlaneZ = wheelDepth / 2 + pinLength * 0.64;
  const pinFrontZ = wheelDepth / 2 + pinLength;
  const plateClearance = 0.05;
  const plateBackZ = pinFrontZ + plateClearance;
  const plateThickness = 0.10;
  const plateFrontZ = plateBackZ + plateThickness;
  const workingClearance = 0.003;

  const outerLockReferenceAngle = THREE.MathUtils.degToRad(3);
  const innerLockReferenceAngle = -outerLockReferenceAngle;
  const meanPalletRadius = (
    palletPivot.distanceTo(wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(outerLockReferenceAngle) * pinOrbitRadius,
      Math.sin(outerLockReferenceAngle) * pinOrbitRadius,
    )))
      + palletPivot.distanceTo(wheelCenter.clone().add(new THREE.Vector2(
        Math.cos(innerLockReferenceAngle) * pinOrbitRadius,
        Math.sin(innerLockReferenceAngle) * pinOrbitRadius,
      )))
  ) / 2;
  const sourcePendulumTotalSwing = THREE.MathUtils.degToRad(4);
  const palletAmplitude = sourcePendulumTotalSwing / 2;
  const sourcePinAngularDiameter = THREE.MathUtils.degToRad(4);
  const pinRadius = meanPalletRadius
    * Math.sin(sourcePinAngularDiameter / 2);

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  // Pallet amplitude fractions: the pin lands on the resting face at the
  // landing fraction; the resting face ends at the rounded pallet tip,
  // reached as the returning pallet passes the unlocking fraction; the pin
  // rolls over that tip (the lift is on the pin) and leaves it at release.
  // With Goodrich's proportions the tip travel over the whole swing only
  // equals the pin diameter, so most of the swing is lift and the drop is
  // what remains of the half pitch.
  const landingAmplitudeFraction = 0.86;
  const lockingAmplitudeFraction = 0.80;
  const releaseAmplitudeFraction = 0.02;
  const tipRoundingRadius = 0.012;
  const landingHalfPhase = Math.asin(landingAmplitudeFraction) / Math.PI;
  const impulseStartHalfPhase = 1
    - Math.asin(lockingAmplitudeFraction) / Math.PI;
  const releaseHalfPhase = 1
    - Math.asin(releaseAmplitudeFraction) / Math.PI;
  const impulsePalletSpan = (
    lockingAmplitudeFraction - releaseAmplitudeFraction
  ) * palletAmplitude;
  const dropDuration = (
    1 - releaseHalfPhase + landingHalfPhase
  ) * halfBeatDuration;
  const sourceTimeOffset = halfBeatDuration / 2;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const palletNameForSide = (side) => (
    side > 0 ? 'higher-outer' : 'lower-inner'
  );
  const lockReferenceAngleForSide = (side) => (
    side > 0 ? outerLockReferenceAngle : innerLockReferenceAngle
  );
  const activePinSequenceForHalfBeat = (halfBeatIndex) => (
    Math.floor(halfBeatIndex / 2)
  );
  const activePinIndexForHalfBeat = (halfBeatIndex) => positiveModulo(
    activePinSequenceForHalfBeat(halfBeatIndex),
    pinCount,
  );
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    lockReferenceAngleForSide(sideForHalfBeat(halfBeatIndex))
      - activePinSequenceForHalfBeat(halfBeatIndex) * pinPitch
  );
  const lockPinCenterForSide = (side) => {
    const angle = lockReferenceAngleForSide(side);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
    ));
  };
  const impulseProgressAtPalletAngle = (side, palletAngle) => (
    (
      lockingAmplitudeFraction * palletAmplitude
        - palletSense * side * palletAngle
    ) / impulsePalletSpan
  );
  const normalSenseForSide = (side) => {
    const palletAngle = palletSense * side * palletAmplitude;
    const worldCenter = lockPinCenterForSide(side);
    const center = rotate2(worldCenter.clone().sub(palletPivot), -palletAngle);
    const tangent = rotate2(
      crossZ(worldCenter.clone().sub(palletPivot)).multiplyScalar(-1),
      -palletAngle,
    );
    return new THREE.Vector2(-tangent.y, tangent.x).dot(center) > 0 ? 1 : -1;
  };
  const lockFrameLocal = (side, palletAngle) => {
    const worldCenter = lockPinCenterForSide(side);
    const center = rotate2(worldCenter.clone().sub(palletPivot), -palletAngle);
    const tangent = rotate2(
      crossZ(worldCenter.clone().sub(palletPivot)).multiplyScalar(-1),
      -palletAngle,
    ).normalize();
    const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x)
      .multiplyScalar(normalSenseForSide(side));
    return { center, outwardNormal, tangent };
  };
  // Centre of the small rounding at each pallet tip, in the pallet frame:
  // the resting arc ends where the pin sits when unlocking begins.
  const tipCenterCache = new Map();
  const tipCenterLocal = (side) => {
    if (!tipCenterCache.has(side)) {
      const frame = lockFrameLocal(
        side,
        palletSense * side * lockingAmplitudeFraction * palletAmplitude,
      );
      tipCenterCache.set(side, frame.center.clone().addScaledVector(
        frame.outwardNormal,
        pinRadius + tipRoundingRadius,
      ));
    }
    return tipCenterCache.get(side).clone();
  };
  const rollRadius = pinRadius + tipRoundingRadius;
  // While the pin rolls over the tip its centre stays rollRadius from the
  // tip centre and on the pin circle: a closed-form circle intersection,
  // with exact first and second derivatives by implicit differentiation.
  const rollingSolution = (side, palletAngle) => {
    const tipRelative = rotate2(tipCenterLocal(side), palletAngle);
    const tip = tipRelative.clone().add(palletPivot);
    const distance = tip.length();
    const along = (
      pinOrbitRadius ** 2 - rollRadius ** 2 + distance ** 2
    ) / (2 * distance);
    const across = Math.sqrt(Math.max(0, pinOrbitRadius ** 2 - along ** 2));
    const angle = Math.atan2(tip.y, tip.x) + Math.atan2(across, along);
    const pin = new THREE.Vector2(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
    );
    const pinRate = crossZ(pin);
    const tipRate = crossZ(tipRelative);
    const offset = pin.clone().sub(tip);
    const numerator = offset.dot(tipRate);
    const denominator = offset.dot(pinRate);
    const slope = numerator / denominator;
    const offsetRate = pinRate.clone().multiplyScalar(slope).sub(tipRate);
    const numeratorRate = offsetRate.dot(tipRate)
      - offset.dot(tipRelative);
    const denominatorRate = offsetRate.dot(pinRate)
      - offset.dot(pin) * slope;
    const curvature = (
      numeratorRate * denominator - numerator * denominatorRate
    ) / denominator ** 2;
    return { angle, curvature, slope };
  };
  const impulseWheelDeltaAtPalletAngle = (side, palletAngle) => (
    rollingSolution(side, palletAngle).angle
      - lockReferenceAngleForSide(side)
  );
  const impulseWheelSlopeAtPalletAngle = (side, palletAngle) => (
    rollingSolution(side, palletAngle).slope
  );
  const impulsePinCenter = (side, palletAngle) => {
    const angle = rollingSolution(side, palletAngle).angle;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
    ));
  };
  const centerFrameLocal = (side, palletAngle, mode) => {
    const worldCenter = mode === 'lock'
      ? lockPinCenterForSide(side)
      : impulsePinCenter(side, palletAngle);
    const center = rotate2(
      worldCenter.clone().sub(palletPivot),
      -palletAngle,
    );
    const wheelSlope = mode === 'lock'
      ? 0
      : impulseWheelSlopeAtPalletAngle(side, palletAngle);
    const centerDerivativeWorld = crossZ(
      worldCenter.clone().sub(wheelCenter),
    ).multiplyScalar(wheelSlope).sub(crossZ(
      worldCenter.clone().sub(palletPivot),
    ));
    const tangent = rotate2(
      centerDerivativeWorld,
      -palletAngle,
    ).normalize();
    // The normal keeps one rotation sense from the tangent for each pallet,
    // fixed where the concentric rest makes "away from the arbor"
    // unambiguous; a per-point sign test flips on steep impulse faces.
    const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x)
      .multiplyScalar(normalSenseForSide(side));
    return { center, outwardNormal, tangent };
  };
  const palletFaceFrame = (side, palletAngle, mode) => {
    const centerFrame = centerFrameLocal(side, palletAngle, mode);
    const point = centerFrame.center.clone().addScaledVector(
      centerFrame.outwardNormal,
      pinRadius,
    );
    return {
      ...centerFrame,
      point,
    };
  };
  const palletFaceLocalPoint = (side, palletAngle, mode) => (
    palletFaceFrame(side, palletAngle, mode).point
  );
  const lockFacePoints = (side, pointCount = 49) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * palletAmplitude,
        palletAmplitude,
        index / (pointCount - 1),
      );
      return palletFaceLocalPoint(
        side,
        palletSense * side * magnitude,
        'lock',
      );
    },
  );
  const impulseFacePoints = (side, pointCount = 37) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * palletAmplitude,
        releaseAmplitudeFraction * palletAmplitude,
        index / (pointCount - 1),
      );
      return palletFaceLocalPoint(
        side,
        palletSense * side * magnitude,
        'impulse',
      );
    },
  );

  // Release state and constant-acceleration drop for each pallet; the
  // drop takes the wheel through the rest of the half pitch.
  const releaseCache = new Map();
  const releaseForSide = (side) => {
    if (!releaseCache.has(side)) {
      const swing = palletSense * side;
      const releaseAngle = swing * releaseAmplitudeFraction * palletAmplitude;
      const palletSpeed = swing * palletAmplitude * Math.PI
        * Math.cos(Math.PI * releaseHalfPhase) / halfBeatDuration;
      const palletAcceleration = -swing * palletAmplitude * Math.PI ** 2
        * Math.sin(Math.PI * releaseHalfPhase) / halfBeatDuration ** 2;
      const solution = rollingSolution(side, releaseAngle);
      const impulseAdvance = Math.abs(
        solution.angle - lockReferenceAngleForSide(side),
      );
      const freeDropAdvance = halfPinPitch - impulseAdvance;
      const wheelSpeed = solution.slope * palletSpeed;
      const wheelAcceleration = solution.curvature * palletSpeed ** 2
        + solution.slope * palletAcceleration;
      const dropAcceleration = 2 * (
        direction * freeDropAdvance - wheelSpeed * dropDuration
      ) / dropDuration ** 2;
      releaseCache.set(side, {
        dropAcceleration,
        freeDropAdvance,
        impulseAdvance,
        landingWheelSpeed: wheelSpeed + dropAcceleration * dropDuration,
        wheelAcceleration,
        wheelSpeed,
      });
    }
    return releaseCache.get(side);
  };

  const pinProfileForWheelPosition = (pinIndex, wheelAngle) => (
    Math.cos(pinIndex * pinPitch + wheelAngle) >= 0
      ? 'preferred-B'
      : 'legacy-A'
  );
  let pinProfileForIndex = null;

  const baseStateAtTime = (time) => {
    const halfBeatCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfBeatCoordinate);
    const halfPhase = halfBeatCoordinate - halfBeatIndex;
    const side = sideForHalfBeat(halfBeatIndex);
    const swing = palletSense * side;
    const palletAngle = swing * palletAmplitude
      * Math.sin(Math.PI * halfPhase);
    const palletAngularSpeed = swing * palletAmplitude * Math.PI
      * Math.cos(Math.PI * halfPhase) / halfBeatDuration;
    const palletAngularAcceleration = -swing * palletAmplitude * Math.PI ** 2
      * Math.sin(Math.PI * halfPhase) / halfBeatDuration ** 2;
    const eventTolerance = 1e-12;
    const lockActive = halfPhase >= landingHalfPhase - eventTolerance
      && halfPhase < impulseStartHalfPhase - eventTolerance;
    const impulseActive = halfPhase >= (
      impulseStartHalfPhase - eventTolerance
    ) && halfPhase <= releaseHalfPhase + eventTolerance;
    const contactActive = lockActive || impulseActive;
    let wheelAngle;
    let wheelAngularSpeed;
    let wheelAngularAcceleration;
    let activeHalfBeatIndex = halfBeatIndex;
    let stage;
    let dropProgress = null;
    let impulseProgress = null;
    if (lockActive) {
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex);
      wheelAngularSpeed = 0;
      wheelAngularAcceleration = 0;
      stage = Math.abs(halfPhase - 0.5) <= eventTolerance
        ? `${palletNameForSide(side)}-maximum-deadbeat-lock`
        : `${palletNameForSide(side)}-concentric-deadbeat-lock`;
    } else if (impulseActive) {
      impulseProgress = THREE.MathUtils.clamp(
        impulseProgressAtPalletAngle(side, palletAngle),
        0,
        1,
      );
      const rolling = rollingSolution(side, palletAngle);
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex)
        + rolling.angle - lockReferenceAngleForSide(side);
      wheelAngularSpeed = rolling.slope * palletAngularSpeed;
      wheelAngularAcceleration = rolling.curvature * palletAngularSpeed ** 2
        + rolling.slope * palletAngularAcceleration;
      stage = `${palletNameForSide(side)}-downward-impulse`;
    } else {
      const earlyDrop = halfPhase < landingHalfPhase;
      const dropStartHalfBeat = earlyDrop
        ? halfBeatIndex - 1
        : halfBeatIndex;
      const dropEndHalfBeat = dropStartHalfBeat + 1;
      const dropStartCoordinate = dropStartHalfBeat + releaseHalfPhase;
      const currentCoordinate = halfBeatIndex + halfPhase;
      const elapsedDropTime = (
        currentCoordinate - dropStartCoordinate
      ) * halfBeatDuration;
      dropProgress = elapsedDropTime / dropDuration;
      const release = releaseForSide(sideForHalfBeat(dropStartHalfBeat));
      wheelAngle = wheelAngleAtHalfLanding(dropStartHalfBeat)
        + direction * release.impulseAdvance
        + release.wheelSpeed * elapsedDropTime
        + 0.5 * release.dropAcceleration * elapsedDropTime ** 2;
      wheelAngularSpeed = release.wheelSpeed
        + release.dropAcceleration * elapsedDropTime;
      wheelAngularAcceleration = release.dropAcceleration;
      activeHalfBeatIndex = dropEndHalfBeat;
      stage = `clockwise-free-drop-to-${palletNameForSide(
        sideForHalfBeat(dropEndHalfBeat),
      )}-pallet`;
    }

    const activeSide = contactActive
      ? side
      : sideForHalfBeat(activeHalfBeatIndex);
    const activePinIndex = activePinIndexForHalfBeat(activeHalfBeatIndex);
    const activePinAngle = wheelAngle + activePinIndex * pinPitch;
    const activePinCenter = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(activePinAngle) * pinOrbitRadius,
      Math.sin(activePinAngle) * pinOrbitRadius,
    ));
    let contact = null;
    if (contactActive) {
      const mode = lockActive ? 'lock' : 'impulse';
      const faceFrame = palletFaceFrame(activeSide, palletAngle, mode);
      const expectedPoint = palletPivot.clone().add(
        rotate2(faceFrame.point, palletAngle),
      );
      const pinOffsetWorld = rotate2(
        faceFrame.point.clone().sub(faceFrame.center),
        palletAngle,
      );
      const pinSurfacePoint = activePinCenter.clone().add(pinOffsetWorld);
      const faceTangent = rotate2(faceFrame.tangent, palletAngle);
      // Unit normal from the pin into the pallet material: the direction
      // in which the pin presses the pallet.
      const faceNormal = rotate2(faceFrame.outwardNormal, palletAngle)
        .normalize();
      const pinMaterialVelocity = crossZ(
        pinSurfacePoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(
        expectedPoint.clone().sub(palletPivot),
      ).multiplyScalar(palletAngularSpeed);
      const relativeVelocity = pinMaterialVelocity.clone()
        .sub(palletMaterialVelocity);
      const pinLocalOffset = rotate2(pinOffsetWorld, -activePinAngle);
      contact = {
        concentricRadiusError: lockActive
          ? Math.abs(
            faceFrame.point.length()
              - (lockPinCenterForSide(activeSide)
                .distanceTo(palletPivot) + pinRadius)
          )
          : null,
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: faceFrame.point,
        mode: lockActive ? 'concentric-rest' : 'downward-impulse',
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletMaterialVelocity,
        palletName: palletNameForSide(activeSide),
        pinContactAngle: Math.atan2(pinLocalOffset.y, pinLocalOffset.x),
        pinMaterialVelocity,
        pinProfile: pinProfileForIndex?.(activePinIndex) ?? null,
        pinSurfacePoint,
        pointError: pinSurfacePoint.distanceTo(expectedPoint),
        radialClearanceError: activePinCenter.distanceTo(pinSurfacePoint)
          - pinRadius,
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
      };
    }
    return {
      activeHalfBeatIndex,
      activePinAngle,
      activePinCenter,
      activePinIndex,
      activePinProfile: pinProfileForIndex?.(activePinIndex) ?? null,
      activeSide,
      contact,
      contactActive,
      contactMode: contact?.mode ?? null,
      dropProgress,
      halfBeatIndex,
      halfPhase,
      impulseProgress,
      lockActive,
      palletAngle,
      palletAngularAcceleration,
      palletAngularSpeed,
      palletName: palletNameForSide(activeSide),
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const sourceBaseState = baseStateAtTime(sourceTimeOffset);
  const sourcePoseWheelAngle = sourceBaseState.wheelAngle;
  pinProfileForIndex = (pinIndex) => pinProfileForWheelPosition(
    pinIndex,
    sourcePoseWheelAngle,
  );

  // Every pin surface point that ever touches a pallet, in the pin's own
  // frame (x radial outward, y along the counter-clockwise tangent). The B
  // pin keeps exactly this arc plus a small margin; the A pin keeps the
  // whole leading half.
  const contactAngleSamples = [];
  for (let sample = 0; sample < 1600; sample += 1) {
    const state = baseStateAtTime(sample / 1600 * pendulumPeriod);
    if (state.contactActive) {
      contactAngleSamples.push(state.contact.pinContactAngle);
    }
  }
  const preferredArcMargin = THREE.MathUtils.degToRad(6);
  const preferredArcStart = Math.min(...contactAngleSamples)
    - preferredArcMargin;
  const preferredArcEnd = Math.max(...contactAngleSamples)
    + preferredArcMargin;

  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.54,
  });
  const preferredPinMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    roughness: 0.46,
  });
  const palletMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });

  // Escape wheel: rim, five broad spokes and a hub with eight bolt heads.
  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-thirty-pin-single-face-Le-Paute-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-stepping-pin-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const rimCircle = (radius) => Array.from({ length: 240 }, (_, index) => [
    Math.cos(index * FULL_TURN / 240) * radius,
    Math.sin(index * FULL_TURN / 240) * radius,
  ]);
  const rimOuter = rimCircle(wheelOuterRadius);
  const rimInner = rimCircle(wheelInnerRadius).reverse();
  const wheelRim = new THREE.Mesh(
    plate(
      [[[...rimOuter, rimOuter[0]], [...rimInner, rimInner[0]]]],
      -wheelDepth / 2,
      wheelDepth / 2,
    ),
    wheelMaterial,
  );
  wheelRim.userData.role = 'source-annular-pin-wheel-rim';
  wheelRotor.add(wheelRim);

  const hubRadius = sourceRasterHubRadius * sourceScale;
  const spokeMeshes = [];
  for (let spokeIndex = 0; spokeIndex < 5; spokeIndex += 1) {
    const angle = Math.PI + spokeIndex * FULL_TURN / 5;
    const innerEnd = hubRadius - 0.10;
    const outerEnd = wheelInnerRadius + 0.10;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(outerEnd - innerEnd, 0.34, wheelDepth * 0.82),
      wheelMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * (innerEnd + outerEnd) / 2,
      Math.sin(angle) * (innerEnd + outerEnd) / 2,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.index = spokeIndex;
    spoke.userData.role = 'five-arm-pin-wheel-spoke';
    spokeMeshes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelArborRadius = 0.12;
  const wheelHub = new THREE.Mesh(
    boredLatheGeometry([
      { axial: -0.22, radial: hubRadius },
      { axial: 0.22, radial: hubRadius },
      { axial: 0.22, radial: 0.30 },
      { axial: 0.33, radial: 0.30 },
    ], wheelArborRadius + 0.015, 48),
    wheelMaterial,
  );
  wheelHub.rotation.x = Math.PI / 2;
  wheelHub.userData.role = 'pin-wheel-hub-with-central-boss';
  wheelRotor.add(wheelHub);
  const hubBoltMeshes = [];
  const hubBoltRadius = sourceRasterHubBoltCircleRadius * sourceScale;
  for (let boltIndex = 0; boltIndex < 8; boltIndex += 1) {
    const angle = Math.PI / 8 + boltIndex * FULL_TURN / 8;
    const bolt = cylinderAlongZ(0.075, 0.08, darkMaterial, 18);
    bolt.position.set(
      Math.cos(angle) * hubBoltRadius,
      Math.sin(angle) * hubBoltRadius,
      0.22,
    );
    bolt.userData.index = boltIndex;
    bolt.userData.role = 'source-hub-bolt';
    hubBoltMeshes.push(bolt);
    wheelRotor.add(bolt);
  }

  // Pins, drawn in each pin's frame (x radial outward, y along the
  // counter-clockwise tangent; the leading, working side is -y).
  const arcPoints = (radius, start, end, count) => Array.from(
    { length: count + 1 },
    (_, index) => {
      const angle = THREE.MathUtils.lerp(start, end, index / count);
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    },
  );
  // A: Brown's half-round (D) pin, its flat trailing side along the radius.
  // B: Brown's thin slanted slip, nearly radial, cut from the leading side
  // of the A outline so both forms work the same pallets: its curved leading
  // face is exactly the arc the pallets touch (with a small margin) and its
  // straight trailing face is that arc's chord.
  const legacyPinOutline = () => arcPoints(pinRadius, Math.PI, FULL_TURN, 24);
  const preferredPinOutline = () => arcPoints(pinRadius, preferredArcStart, preferredArcEnd, 18);
  const outlineShape = (points) => polygonShape(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const preferredMidAngle = (preferredArcStart + preferredArcEnd) / 2;
  const preferredChordDepth = pinRadius
    * Math.cos((preferredArcEnd - preferredArcStart) / 2);
  const rivetOffsetRadius = (pinRadius + preferredChordDepth) / 2;
  const rivetRadius = Math.min(
    0.4 * (pinRadius - preferredChordDepth),
    0.32 * pinRadius,
  );
  // The stem is set in a blind hole in the rim: the back face stays plain.
  const rivetBackZ = -wheelDepth / 2 + 0.06;
  const rivetFrontZ = wheelDepth / 2 + 0.03;
  const pinGroupZ = wheelDepth / 2 + pinLength / 2;
  const pinMeshes = [];
  const legacyPins = [];
  const preferredPins = [];
  for (let pinIndex = 0; pinIndex < pinCount; pinIndex += 1) {
    const angle = pinIndex * pinPitch;
    const profile = pinProfileForIndex(pinIndex);
    const pinGroup = new THREE.Group();
    pinGroup.position.set(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
      pinGroupZ,
    );
    pinGroup.rotation.z = angle;
    pinGroup.userData.index = pinIndex;
    pinGroup.userData.profile = profile;
    pinGroup.userData.replaceable = true;
    pinGroup.userData.role = profile === 'preferred-B'
      ? 'replaceable-preferred-slip-B-pin'
      : 'replaceable-legacy-half-round-A-pin';
    const body = new THREE.Mesh(
      centeredExtrusion(
        outlineShape(profile === 'preferred-B'
          ? preferredPinOutline()
          : legacyPinOutline()),
        pinLength,
        0,
      ),
      preferredPinMaterial,
    );
    body.userData.role = profile === 'preferred-B'
      ? 'preferred-B-slip-working-body'
      : 'legacy-A-semicircular-working-body';
    // The replaceable stem screws into a blind hole in the rim.
    const rivet = cylinderAlongZ(
      rivetRadius,
      rivetFrontZ - rivetBackZ,
      darkMaterial,
      18,
    );
    rivet.position.set(
      Math.cos(preferredMidAngle) * rivetOffsetRadius,
      Math.sin(preferredMidAngle) * rivetOffsetRadius,
      (rivetFrontZ + rivetBackZ) / 2 - pinGroupZ,
    );
    rivet.userData.role = 'replaceable-pin-rivet-stem';
    pinGroup.add(body, rivet);
    pinMeshes.push(pinGroup);
    if (profile === 'preferred-B') preferredPins.push(pinGroup);
    else legacyPins.push(pinGroup);
    wheelRotor.add(pinGroup);
  }

  // Finite pallet bits. Each backing region is bounded by the concentric
  // resting arc, the generated impulse face and a generous body; every
  // position any pin (A outline, which contains B) occupies during a whole
  // cycle, dilated by a small working clearance, is then removed.
  const carvingOutline = [
    ...arcPoints(pinRadius + workingClearance, Math.PI, FULL_TURN, 20),
    [pinRadius + workingClearance, workingClearance],
    [-(pinRadius + workingClearance), workingClearance],
  ];
  const sweepTimes = new Set();
  const sweepSamples = 1440;
  for (let sample = 0; sample <= sweepSamples; sample += 1) {
    sweepTimes.add(sample / sweepSamples * pendulumPeriod);
  }
  for (let halfBeat = 0; halfBeat < 2; halfBeat += 1) {
    for (const phase of [
      landingHalfPhase,
      impulseStartHalfPhase,
      releaseHalfPhase,
    ]) sweepTimes.add((halfBeat + phase) * halfBeatDuration);
  }
  const sweepStates = [...sweepTimes].sort((a, b) => a - b)
    .map((time) => baseStateAtTime(time));
  const pinOutlineInPalletFrame = (state, pinIndex) => {
    const pinAngle = state.wheelAngle + pinIndex * pinPitch;
    return carvingOutline.map(([x, y]) => {
      const world = rotate2(
        new THREE.Vector2(x + pinOrbitRadius, y),
        pinAngle,
      ).add(wheelCenter).sub(palletPivot);
      const local = rotate2(world, -state.palletAngle);
      return [local.x, local.y];
    });
  };
  // Consecutive sampled pin outlines are merged into short convex chunks
  // (at most sweepChunkLength of travel); a chunk hull over-covers the true
  // sweep only by its tiny sagitta, never cutting into the convex side the
  // working faces lie on.
  const sweepChunkLength = 0.02;
  const snap = (value) => Math.round(value * 1e7) / 1e7;
  const sweptPinHulls = (bounds) => {
    const hulls = [];
    const flush = (chunk) => {
      if (chunk.length < 2) return;
      const hull = lePautePinConvexHull(chunk.flat())
        .map(([x, y]) => [snap(x), snap(y)]);
      const inside = hull.some(([x, y]) => x > bounds.minX
        && x < bounds.maxX && y > bounds.minY && y < bounds.maxY);
      if (inside) hulls.push([[...hull, hull[0]]]);
    };
    for (let pinIndex = 0; pinIndex < pinCount; pinIndex += 1) {
      let chunk = [];
      for (const state of sweepStates) {
        const pinAngle = positiveModulo(
          state.wheelAngle + pinIndex * pinPitch + Math.PI,
          FULL_TURN,
        ) - Math.PI;
        if (Math.abs(pinAngle) > THREE.MathUtils.degToRad(45)) {
          flush(chunk);
          chunk = [];
          continue;
        }
        const outline = pinOutlineInPalletFrame(state, pinIndex);
        if (chunk.length > 0) {
          const start = chunk[0];
          const travel = Math.max(...[0, 10, 20].map((index) => Math.hypot(
            outline[index][0] - start[index][0],
            outline[index][1] - start[index][1],
          )));
          if (travel > sweepChunkLength) {
            const last = chunk.at(-1);
            flush(chunk);
            chunk = [last];
          }
        }
        chunk.push(outline);
      }
      flush(chunk);
    }
    return hulls;
  };
  const toPair = (point) => [point.x, point.y];
  const backingDepth = 0.30;
  const backingUndercut = 0.16;
  const makeBacking = (side) => {
    const lock = lockFacePoints(side, 49);
    const impulse = impulseFacePoints(side, 37);
    const restRadius = lock[0].length();
    const angleOf = (point) => Math.atan2(point.y, point.x);
    const junctionAngle = angleOf(lock[0]);
    const farSign = Math.sign(angleOf(lock.at(-1)) - junctionAngle);
    const farAngle = junctionAngle + farSign * 0.20;
    const polarPoint = (radius, angle) => [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    ];
    const release = impulse.at(-1);
    // Pallet frame x runs toward the far (body) side for the outer pallet
    // and away from it for the inner one.
    const bodyX = farSign > 0 ? 1 : -1;
    const ring = [
      ...impulse.slice().reverse().map(toPair),
      ...Array.from({ length: 61 }, (_, index) => polarPoint(
        restRadius,
        THREE.MathUtils.lerp(junctionAngle, farAngle, index / 60),
      )).slice(1),
      polarPoint(restRadius + backingDepth, farAngle),
      [release.x + bodyX * backingUndercut, release.y - backingDepth + 0.04],
    ];
    const signedArea = ring.reduce((sum, point, index) => {
      const next = ring[(index + 1) % ring.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0);
    if (signedArea < 0) ring.reverse();
    return { impulse, lock, polygon: [[[...ring, ring[0]]]] };
  };
  const carvePallet = (side) => {
    const backing = makeBacking(side);
    const ring = backing.polygon[0][0];
    const bounds = {
      maxX: Math.max(...ring.map(([x]) => x)),
      maxY: Math.max(...ring.map(([, y]) => y)),
      minX: Math.min(...ring.map(([x]) => x)),
      minY: Math.min(...ring.map(([, y]) => y)),
    };
    const hulls = sweptPinHulls(bounds);
    const carved = polygonClipping.difference(backing.polygon, ...hulls);
    // Keep only the piece carrying the working faces.
    const junction = toPair(backing.lock[0]);
    const kept = carved.slice().sort((a, b) => (
      lePautePinSignedDistance(junction, [a])
        - lePautePinSignedDistance(junction, [b])
    ))[0];
    return { ...backing, carved: [kept] };
  };

  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role =
    'pendulum-rocked-broad-plate-with-inner-and-outer-pallets';

  const bitBackZ = workingPlaneZ - palletDepth / 2;
  const makePallet = (side) => {
    const palletName = palletNameForSide(side);
    const carved = carvePallet(side);
    const body = new THREE.Mesh(
      plate(carved.carved, bitBackZ, plateBackZ + 0.01),
      palletMaterial,
    );
    body.userData.role = `${palletName}-pallet-working-bit`;
    const group = new THREE.Group();
    group.userData.role = `${palletName}-finite-pin-wheel-pallet`;
    group.userData.side = side;
    group.add(body);
    return {
      body,
      carved: carved.carved,
      group,
      impulsePoints: carved.impulse,
      lockPoints: carved.lock,
    };
  };
  const outerPallet = makePallet(1);
  const innerPallet = makePallet(-1);

  // Brown's broad plate: a rectangle as wide as the round collet, hanging
  // in front of the pin ends, opened between a left leg (carrying the inner
  // pallet) and a right leg (carrying the outer pallet).
  const sourceToLocal = (x, y) => {
    const point = sourcePointToModel({ x, y }).sub(palletPivot);
    return [point.x, point.y];
  };
  const colletRadius = sourceRasterColletRadius * sourceScale;
  const colletOutline = arcPoints(colletRadius, 0, FULL_TURN, 96).slice(0, -1);
  const PLATE_LEGS = {
    left: [
      [287, 101], [345, 101], [345, 172], [318, 345],
      [283, 345],
    ],
    right: [
      [373, 101], [431, 101], [421, 352], [392, 352],
      [390, 335], [373, 172],
    ],
  };
  // Each leg's foot is the hull of its pallet bit and the leg's lower
  // corners, so the plate outline ends in the bit as Brown draws it.
  const legFoot = (pallet, corners) => {
    const hull = lePautePinConvexHull([
      ...pallet.carved[0][0],
      ...corners.map(([x, y]) => sourceToLocal(x, y)),
    ]);
    return [[...hull, hull[0]]];
  };
  const plateOutline = polygonClipping.union(
    [[[...colletOutline, colletOutline[0]]]],
    ...Object.values(PLATE_LEGS).map((points) => {
      const ring = points.map(([x, y]) => sourceToLocal(x, y));
      return [[...ring, ring[0]]];
    }),
    legFoot(innerPallet, [[283, 345], [318, 345]]),
    legFoot(outerPallet, [[392, 352], [421, 352], [421, 335]]),
  );
  const broadPlate = new THREE.Mesh(
    plate(plateOutline, plateBackZ, plateFrontZ),
    palletMaterial,
  );
  broadPlate.userData.role = 'source-broad-pallet-plate-in-front-of-pins';

  const colletZ = plateFrontZ + 0.04;
  const collet = boredCylinderAlongZ(colletRadius, 0.08, 0.13, palletMaterial, 72);
  collet.position.z = colletZ;
  collet.userData.role = 'source-round-collet-on-pallet-arbor';
  const colletRing = boredCylinderAlongZ(0.40, 0.06, 0.13, palletMaterial, 48);
  colletRing.position.z = colletZ + 0.07;
  colletRing.userData.role = 'source-collet-center-ring';
  const palletPivotHub = cylinderAlongZ(0.10, colletZ + 0.06 + 0.72, darkMaterial, 30);
  palletPivotHub.position.z = (colletZ + 0.06 - 0.72) / 2;
  palletPivotHub.userData.role = 'common-pin-wheel-pallet-arbor';
  const colletScrews = [];
  for (const [index, sourceX, slot] of [[0, 313, 1.05], [1, 405, 1.45]]) {
    const [x, y] = sourceToLocal(sourceX, 101);
    const screw = new THREE.Group();
    screw.position.set(x, y, colletZ + 0.07);
    const head = cylinderAlongZ(0.21, 0.06, frameMaterial, 30);
    const slotMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.05, 0.02),
      darkMaterial,
    );
    slotMesh.position.z = 0.035;
    slotMesh.rotation.z = slot;
    screw.add(head, slotMesh);
    screw.userData.index = index;
    screw.userData.role = 'source-collet-screw';
    colletScrews.push(screw);
  }
  const sidePlateRing = [[381, 241], [421, 241], [421, 346], [381, 346]]
    .map(([x, y]) => sourceToLocal(x, y));
  const sidePlate = new THREE.Mesh(
    plate([[[...sidePlateRing, sidePlateRing[0]]]], plateFrontZ, plateFrontZ + 0.05),
    palletMaterial,
  );
  sidePlate.userData.role = 'source-small-screwed-side-plate';
  const sidePlateScrews = [264, 305].map((sourceY, index) => {
    const [x, y] = sourceToLocal(402, sourceY);
    const screw = cylinderAlongZ(0.07, 0.04, darkMaterial, 18);
    screw.position.set(x, y, plateFrontZ + 0.07);
    screw.userData.index = index;
    screw.userData.role = 'source-side-plate-screw';
    return screw;
  });
  palletAssembly.add(
    outerPallet.group,
    innerPallet.group,
    broadPlate,
    collet,
    colletRing,
    palletPivotHub,
    ...colletScrews,
    sidePlate,
    ...sidePlateScrews,
  );

  // Fixed arbors behind the moving parts; no frame is drawn by Brown.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-pin-wheel-and-pallet-arbor-bearings';
  const wheelShaft = cylinderAlongZ(wheelArborRadius, 0.33 + 0.70, darkMaterial, 30);
  wheelShaft.position.z = (0.30 - 0.73) / 2;
  wheelShaft.userData.role = 'fixed-pin-wheel-arbor';
  const wheelBearing = cylinderAlongZ(0.30, 0.16, frameMaterial, 36);
  wheelBearing.position.z = -0.58;
  wheelBearing.userData.role = 'fixed-pin-wheel-arbor-rear-bearing';
  const palletBearing = boredCylinderAlongZ(0.30, 0.16, 0.115, frameMaterial, 36);
  palletBearing.position.set(palletPivot.x, palletPivot.y, -0.58);
  palletBearing.userData.role = 'fixed-pallet-arbor-rear-bearing';
  fixedFrame.add(wheelShaft, wheelBearing, palletBearing);
  root.add(fixedFrame, escapeWheel, palletAssembly);

  const stateAtTime = (time) => {
    const state = baseStateAtTime(time + sourceTimeOffset);
    const cycleCoordinate = time / pendulumPeriod;
    return {
      ...state,
      cycleIndex: Math.floor(cycleCoordinate),
      cyclePhase: positiveModulo(cycleCoordinate, 1),
      pinsAdvanced: (
        sourceBaseState.wheelAngle - state.wheelAngle
      ) / pinPitch,
      sourcePose: Math.abs(positiveModulo(cycleCoordinate, 1)) < 1e-12,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const timeFromBase = (baseTime) => positiveModulo(
    baseTime - sourceTimeOffset,
    pendulumPeriod,
  );
  const canonicalTimes = {
    cycleClosure: pendulumPeriod,
    innerImpulseStart: timeFromBase(
      halfBeatDuration + impulseStartHalfPhase * halfBeatDuration,
    ),
    innerLanding: timeFromBase(
      halfBeatDuration + landingHalfPhase * halfBeatDuration,
    ),
    innerMaximumLock: timeFromBase(halfBeatDuration * 1.5),
    innerRelease: timeFromBase(
      halfBeatDuration + releaseHalfPhase * halfBeatDuration,
    ),
    outerImpulseStart: timeFromBase(
      impulseStartHalfPhase * halfBeatDuration,
    ),
    outerLanding: timeFromBase(landingHalfPhase * halfBeatDuration),
    outerMaximumLock: 0,
    outerRelease: timeFromBase(releaseHalfPhase * halfBeatDuration),
    sourcePose: 0,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    palletAssembly.rotation.z = state.palletAngle;
    palletAssembly.userData.angularAcceleration =
      state.palletAngularAcceleration;
    palletAssembly.userData.angularSpeed = state.palletAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = state.contactActive
      ? {
        activePallet: `${state.palletName}-pallet`,
        activePinIndex: state.activePinIndex,
        activePinProfile: state.activePinProfile,
        expectedPoint: state.contact.expectedPoint.clone(),
        mode: state.contactMode,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        radialClearanceError: state.contact.radialClearanceError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activePallet: null,
        activePinIndex: state.activePinIndex,
        activePinProfile: state.activePinProfile,
        dropProgress: state.dropProgress,
        mode: null,
        normalVelocityError: null,
        pointError: null,
        radialClearanceError: null,
        relativeSlipSpeed: null,
      };
    root.userData.kinematics = state;
  };

  const radiusRange = (points) => {
    const radii = points.map((point) => point.length());
    return Math.max(...radii) - Math.min(...radii);
  };
  // Signed distance (pallet frame) from a point to the finished pallet
  // material: negative inside, positive in the clear.
  const palletMaterialDistance = (side, localPoint) => (
    lePautePinSignedDistance(
      toPair(localPoint),
      side > 0 ? outerPallet.carved : innerPallet.carved,
    )
  );
  root.userData.archetype = movement.archetype;
  root.userData.mechanism =
    'one clockwise wheel carries thirty replaceable single-plane pins: Brown’s legacy half-round A form on the comparison half and the preferred undercut B form on the other; a broad plate hung from the round collet on the pallet arbor carries adjacent higher-outer and lower-inner pallets whose concentric resting arcs hold the wheel dead and whose two working faces both receive downward impulse';
  root.userData.presentation = 'flat front elevation matching Brown’s plate';
  root.userData.transmission = {
    deadbeat: 'wheel speed and acceleration are exactly zero while a pin rests on either concentric pallet face',
    direction: 'clockwise; every pin moves downward through both adjacent pallet levels',
    halfBeatAdvance: halfPinPitch,
    impulse: 'both pallet impulses act downward, the defining steady-action advantage of Le Paute’s layout',
    oscillationAdvance: pinPitch,
    pinCount,
    preferredPinForm: 'B: Brown\'s thin, nearly radial slip cut from the leading side of the A half-round: a curved leading face that is exactly the arc the pallets touch, and a straight trailing chord',
    recoil: 'none',
  };
  root.userData.blocks = {
    broadPlate,
    collet,
    colletRing,
    colletScrews,
    escapeWheel,
    fixedFrame,
    hubBoltMeshes,
    innerPallet: innerPallet.group,
    innerPalletBody: innerPallet.body,
    legacyPins,
    outerPallet: outerPallet.group,
    outerPalletBody: outerPallet.body,
    palletAssembly,
    palletBearing,
    palletPivotHub,
    pinMeshes,
    preferredPins,
    sidePlate,
    sidePlateScrews,
    spokeMeshes,
    wheelBearing,
    wheelHub,
    wheelRim,
    wheelRotor,
    wheelShaft,
  };
  root.userData.hideGround = true;
  root.userData.cameraFov = 8;
  root.userData.cameraDistanceScale = 1;
  // Brown's square plate, 525 pixels on a side, framed as drawn.
  const plateCorner = sourcePointToModel({ x: 0, y: sourceImageHeight });
  const plateOpposite = sourcePointToModel({ x: sourceImageWidth, y: 0 });
  const plateInset = 0.3;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(plateCorner.x + plateInset, plateCorner.y + plateInset, -0.8),
    new THREE.Vector3(plateOpposite.x - plateInset, plateOpposite.y - plateInset, 1.2),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    bitBackZ,
    colletRadius,
    direction,
    dropDuration,
    eventPeriod: pendulumPeriod,
    halfBeatDuration,
    halfPinPitch,
    impulsePalletSpan,
    impulseStartHalfPhase,
    innerLockReferenceAngle,
    innerRelease: { ...releaseForSide(-1) },
    landingAmplitudeFraction,
    landingHalfPhase,
    legacyPinWorkingArc: Math.PI,
    lockingAmplitudeFraction,
    meanPalletRadius,
    outerLockReferenceAngle,
    outerRelease: { ...releaseForSide(1) },
    palletAmplitude,
    palletDepth,
    palletPivot: palletPivot.clone(),
    palletSense,
    pendulumPeriod,
    pinCount,
    pinFrontZ,
    pinLength,
    pinOrbitRadius,
    pinPitch,
    pinRadius,
    plateBackZ,
    plateFrontZ,
    preferredArcEnd,
    preferredArcStart,
    preferredPinWorkingArc: preferredArcEnd - preferredArcStart,
    releaseAmplitudeFraction,
    releaseHalfPhase,
    rollRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourcePendulumTotalSwing,
    sourcePinAngularDiameter,
    sourceScale,
    sourceTimeOffset,
    tipRoundingRadius,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelOuterRadius,
    workingClearance,
    workingPlaneZ,
  };
  root.userData.impulseFacePoints = impulseFacePoints;
  root.userData.impulsePinCenter = impulsePinCenter;
  root.userData.impulseProgressAtPalletAngle =
    impulseProgressAtPalletAngle;
  root.userData.impulseWheelDeltaAtPalletAngle =
    impulseWheelDeltaAtPalletAngle;
  root.userData.impulseWheelSlopeAtPalletAngle =
    impulseWheelSlopeAtPalletAngle;
  root.userData.lockFacePoints = lockFacePoints;
  root.userData.lockPinCenterForSide = lockPinCenterForSide;
  root.userData.releaseForSide = releaseForSide;
  root.userData.rollingSolution = rollingSolution;
  root.userData.tipCenterLocal = tipCenterLocal;
  root.userData.palletFaceFrame = palletFaceFrame;
  root.userData.palletFaceLocalPoint = palletFaceLocalPoint;
  root.userData.palletMaterialDistance = palletMaterialDistance;
  root.userData.palletProfiles = {
    inner: {
      finiteOutline: innerPallet.carved,
      impulseConcentricRadiusRange: radiusRange(
        innerPallet.impulsePoints,
      ),
      impulseDirection: 'downward',
      impulsePoints: innerPallet.impulsePoints,
      lockConcentricRadiusRange: radiusRange(innerPallet.lockPoints),
      lockPoints: innerPallet.lockPoints,
      position: 'lower pallet on the left leg, reaching out from inside the pin circle',
      side: -1,
    },
    outer: {
      finiteOutline: outerPallet.carved,
      impulseConcentricRadiusRange: radiusRange(
        outerPallet.impulsePoints,
      ),
      impulseDirection: 'downward',
      impulsePoints: outerPallet.impulsePoints,
      lockConcentricRadiusRange: radiusRange(outerPallet.lockPoints),
      lockPoints: outerPallet.lockPoints,
      position: 'higher pallet on the right leg, reaching in from outside the pin circle',
      side: 1,
    },
  };
  root.userData.pinProfiles = {
    legacyA: {
      count: legacyPins.length,
      profile: 'one-half circular cylinder retained; inactive upper half removed',
      sourceLabel: 'A',
      workingArcRadians: Math.PI,
    },
    preferredB: {
      count: preferredPins.length,
      profile: 'thin slip cut from the leading side of the A half-round; its curved leading face is the working arc',
      sourceLabel: 'B',
      workingArcRadians: preferredArcEnd - preferredArcStart,
    },
  };
  root.userData.pinProfileForIndex = pinProfileForIndex;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 304 page marks Animated unavailable and serves Brown’s static comparison plate.',
    referenceScope: 'Brown fixes one pin wheel, the broad pallet plate hung from a round collet with its two pallet bits, replaceable A/B pins, and their two cross-sections. The period construction reference supplies the clockwise direction, thirty-pin count, same-plane pallet offset, four-degree swing, concentric rests, and downward action on both pallets.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    constructionReference: {
      author: 'Ward L. Goodrich',
      chapter: 'IX — Le Paute’s Pin Wheel Escapement',
      details: 'Thirty pins at twelve-degree spacing for a seconds pendulum; a four-degree pallet swing fixes pin diameter; the inner arm is offset to clear the pins; both hardened pallets lie in the same plane; the improved large-clock pin is also relieved on its underside.',
      figures: [39, 40],
      publicationYear: 1905,
      title: 'The Modern Clock',
      url: 'https://www.gutenberg.org/files/61494/61494-h/61494-h.htm',
    },
    officialDescription: movement.description,
    plate304: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one annular wheel with replaceable axial pins in a single working plane; a broad plate hung from the round collet on the upper pallet arbor lies in front of the pin ends, its left leg carrying the lower inner pallet and its right leg the higher outer pallet',
      measurementUncertaintyPixels: 8,
      modeledPinCount: pinCount,
      officialAnimationAvailable: false,
      rasterColletRadius: sourceRasterColletRadius,
      rasterHubBoltCircleRadius: sourceRasterHubBoltCircleRadius,
      rasterInnerPalletTip: sourceRasterInnerPalletTip.clone(),
      rasterLegacyPinA: sourceRasterLegacyPinA.clone(),
      rasterOuterPalletTip: sourceRasterOuterPalletTip.clone(),
      rasterPalletPivot: sourceRasterPalletPivot.clone(),
      rasterPinOrbitRadius: sourceRasterPinOrbitRadius,
      rasterPreferredPinB: sourceRasterPreferredPinB.clone(),
      rasterWheelBounds: sourceRasterWheelBounds,
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelInnerRadius: sourceRasterWheelInnerRadius,
      rasterWheelOuterRadius: sourceRasterWheelOuterRadius,
      sourceDirection: sourceRasterDirection,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.reconstructionNote = 'The pallet schedule (concentric rests, four degrees of impulse, two of drop) is prescribed kinematics; the finite pallet bits are the backing regions with every swept pin position removed, so pins touch only the working faces. Brown draws the two pallets farther apart than one half pitch; the thirty-pin construction keeps them one half pitch apart.';
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'higher-outer-concentric-rest',
      'higher-outer-downward-impulse',
      'two-degree-drop-to-lower-inner-pallet',
      'lower-inner-concentric-rest',
      'lower-inner-downward-impulse',
      'two-degree-drop-to-succeeding-pin-at-higher-outer-pallet',
    ],
  };
  root.userData.wheelAngleAtHalfLanding = wheelAngleAtHalfLanding;

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
  // The thirty pins standing off the rim cast long streaks across its face
  // that the plate does not have; the pins themselves stay lit and shaded.
  for (const pin of pinMeshes) pin.traverse((object) => { object.castShadow = false; });
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(0.05, 0.05, 1),
    root,
    update,
  };
}

export function createAuthoredStudEscapementMovement(movement) {
  switch (movement.id) {
    case 304: return lePautePinWheelEscapement(movement);
    default: return null;
  }
}
