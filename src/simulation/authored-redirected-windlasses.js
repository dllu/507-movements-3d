import {correctCordTraverseParts} from './cord-traverse-working-parts.js';
import * as THREE from 'three';
import { plate, polygonClipping } from './finite-plate-geometry.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {
  CircularArcCurve3,
  PALETTE,
  makeBeam,
  makeDynamicMovingBelt,
  makePulley,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongX(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

class WoundBarrelHelix extends THREE.Curve {
  constructor({
    axialSpan,
    exitPhase,
    exitX,
    radius,
    reverse,
    shaftY,
    wrapSweep,
  }) {
    super();
    this.axialSpan = axialSpan;
    this.exitPhase = exitPhase;
    this.exitX = exitX;
    this.radius = radius;
    this.reverse = reverse;
    this.shaftY = shaftY;
    this.wrapSweep = wrapSweep;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const e=.035,denominator=1-e;
    const smooth=t<e?t*t/(2*e*denominator):t>1-e?1-(1-t)**2/(2*e*denominator):(t-e/2)/denominator;
    const x = this.reverse
      ? this.exitX + this.axialSpan * smooth
      : this.exitX - this.axialSpan * (1 - smooth);
    const phase = this.reverse
      ? this.exitPhase - this.wrapSweep * t
      : this.exitPhase + this.wrapSweep * (1 - t);
    return target.set(
      x,
      this.shaftY + this.radius * Math.cos(phase),
      this.radius * Math.sin(phase),
    );
  }

  getTangent(t, target = new THREE.Vector3()) {
    const e=.035;
    const smoothDerivative=(t<e?t/e:t>1-e?(1-t)/e:1)/(1-e);
    const xDerivative = this.axialSpan * smoothDerivative;
    const phase = this.reverse
      ? this.exitPhase - this.wrapSweep * t
      : this.exitPhase + this.wrapSweep * (1 - t);
    const phaseDerivative = -this.wrapSweep;
    return target.set(
      xDerivative,
      -this.radius * Math.sin(phase) * phaseDerivative,
      this.radius * Math.cos(phase) * phaseDerivative,
    ).normalize();
  }
}

class SegmentedMaterialRopeCurve extends THREE.Curve {
  constructor(curves, segmentLengths, metadata = {}) {
    super();
    this.curves = curves;
    this.segmentLengths = segmentLengths;
    this.totalLength = segmentLengths.reduce(
      (sum, length) => sum + length,
      0,
    );
    Object.assign(this, metadata);
  }

  segmentAtDistance(rawDistance) {
    const distance = THREE.MathUtils.clamp(
      rawDistance,
      0,
      this.totalLength,
    );
    let startDistance = 0;
    for (let index = 0; index < this.curves.length; index += 1) {
      const length = this.segmentLengths[index];
      if (distance <= startDistance + length
        || index === this.curves.length - 1) {
        return {
          curve: this.curves[index],
          index,
          localFraction: length > 0
            ? THREE.MathUtils.clamp(
              (distance - startDistance) / length,
              0,
              1,
            )
            : 0,
          startDistance,
        };
      }
      startDistance += length;
    }
    throw new RangeError('Movement 352 rope segment lookup failed.');
  }

  getPoint(fraction, target = new THREE.Vector3()) {
    return this.getPointAtDistance(fraction * this.totalLength, target);
  }

  getPointAt(fraction, target = new THREE.Vector3()) {
    return this.getPoint(fraction, target);
  }

  getPointAtDistance(distance, target = new THREE.Vector3()) {
    const segment = this.segmentAtDistance(distance);
    return segment.curve.getPoint(segment.localFraction, target);
  }

  getTangent(fraction, target = new THREE.Vector3()) {
    return this.getTangentAtDistance(fraction * this.totalLength, target);
  }

  getTangentAt(fraction, target = new THREE.Vector3()) {
    return this.getTangent(fraction, target);
  }

  getTangentAtDistance(distance, target = new THREE.Vector3()) {
    const segment = this.segmentAtDistance(distance);
    return segment.curve.getTangent(segment.localFraction, target);
  }

  getLength() {
    return this.totalLength;
  }
}

function redirectedChineseWindlass(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Measurements from the 525 px engraving. The barrel contacts are on
  // opposite sides of the common horizontal shaft so one rigid rotation
  // winds the larger barrel while unwinding the smaller one.
  const sourceScale = 0.014;
  const sourceRasterShaftCenter = new THREE.Vector2(287, 410);
  const sourceRasterLargeBarrelRadius = 32;
  const sourceRasterSmallBarrelRadius = 22;
  const sourceRasterLargeRopeX = 203;
  const sourceRasterSmallRopeX = 372;
  const sourceRasterLeftGuideCenter = new THREE.Vector2(225, 162);
  const sourceRasterRightGuideCenter = new THREE.Vector2(341, 160);
  const sourceRasterFixedGuideRadius = 16;
  const sourceRasterMovingPulleyCenter = new THREE.Vector2(288, 187);
  const sourceRasterMovingPulleyRadius = 9;
  const sourceRasterLeftFrameFoot = new THREE.Vector2(28, 518);
  const sourceRasterRightFrameFoot = new THREE.Vector2(489, 518);
  const sourceRasterFrameCrown = new THREE.Vector2(288, 14);

  const shaftY = -2.25;
  const largeBarrelPitchRadius = sourceRasterLargeBarrelRadius
    * sourceScale;
  const smallBarrelPitchRadius = sourceRasterSmallBarrelRadius
    * sourceScale;
  const barrelRadiusDifference = largeBarrelPitchRadius
    - smallBarrelPitchRadius;
  const barrelRadiusSum = largeBarrelPitchRadius
    + smallBarrelPitchRadius;
  const largeRopeExit = new THREE.Vector3(
    (sourceRasterLargeRopeX - sourceRasterShaftCenter.x) * sourceScale,
    shaftY,
    largeBarrelPitchRadius,
  );
  const smallRopeExit = new THREE.Vector3(
    (sourceRasterSmallRopeX - sourceRasterShaftCenter.x) * sourceScale,
    shaftY,
    -smallBarrelPitchRadius,
  );
  const exitMidpoint = largeRopeExit.clone().add(smallRopeExit)
    .multiplyScalar(0.5);
  exitMidpoint.y = 0;
  const exitSeparation = smallRopeExit.clone().sub(largeRopeExit);
  exitSeparation.y = 0;
  const planeHorizontal = exitSeparation.clone().normalize();
  const pulleyAxis = planeHorizontal.clone().cross(Y_AXIS).normalize();
  const exitHalfSpacing = exitSeparation.length() / 2;

  const fixedGuidePitchRadius = sourceRasterFixedGuideRadius
    * sourceScale;
  const movingPulleyPitchRadius = sourceRasterMovingPulleyRadius
    * sourceScale;
  const fixedGuideY = shaftY + (
    sourceRasterShaftCenter.y
      - (sourceRasterLeftGuideCenter.y
        + sourceRasterRightGuideCenter.y) / 2
  ) * sourceScale;
  const sourceMovingPulleyY = fixedGuideY - (
    sourceRasterMovingPulleyCenter.y
      - (sourceRasterLeftGuideCenter.y
        + sourceRasterRightGuideCenter.y) / 2
  ) * sourceScale;
  const fixedCenterPlaneX = exitHalfSpacing - fixedGuidePitchRadius;
  const centerSeparationSum = fixedGuidePitchRadius
    + movingPulleyPitchRadius;
  const verticalLegLength = fixedGuideY - shaftY;
  const ropeRadius = 0.035;

  const planePoint = (planeX, y) => exitMidpoint.clone()
    .addScaledVector(planeHorizontal, planeX)
    .addScaledVector(Y_AXIS, y);
  const planeVector = (planeX, y) => planeHorizontal.clone()
    .multiplyScalar(planeX)
    .addScaledVector(Y_AXIS, y);
  const leftFixedCenter = planePoint(-fixedCenterPlaneX, fixedGuideY);
  const rightFixedCenter = planePoint(fixedCenterPlaneX, fixedGuideY);
  const leftOuterContact = planePoint(-exitHalfSpacing, fixedGuideY);
  const rightOuterContact = planePoint(exitHalfSpacing, fixedGuideY);

  const freeMetricsAtMovingY = (movingY) => {
    const horizontal = fixedCenterPlaneX;
    const vertical = movingY - fixedGuideY;
    const centerDistanceSquared = horizontal ** 2 + vertical ** 2;
    const centerDistance = Math.sqrt(centerDistanceSquared);
    if (centerDistance <= centerSeparationSum) {
      throw new RangeError(
        'Movement 352 moving pulley intersects a fixed redirect sheave.',
      );
    }
    const tangentLength = Math.sqrt(
      centerDistanceSquared - centerSeparationSum ** 2,
    );
    const normalX = (
      horizontal * centerSeparationSum
        - vertical * tangentLength
    ) / centerDistanceSquared;
    const normalY = (
      vertical * centerSeparationSum
        + horizontal * tangentLength
    ) / centerDistanceSquared;
    const normalAngle = Math.atan2(normalY, normalX);
    const fixedWrapSweep = Math.PI - normalAngle;
    const movingWrapSweep = Math.PI - 2 * normalAngle;
    if (fixedWrapSweep <= 0 || movingWrapSweep <= 0) {
      throw new RangeError(
        'Movement 352 rope selected the wrong internal tangent branch.',
      );
    }
    const freeLength = 2 * verticalLegLength
      + 2 * tangentLength
      + 2 * fixedGuidePitchRadius * fixedWrapSweep
      + movingPulleyPitchRadius * movingWrapSweep;
    const tangentLengthDerivative = vertical / tangentLength;
    const normalNumerator = horizontal * centerSeparationSum
      - vertical * tangentLength;
    const normalNumeratorDerivative = -tangentLength
      - vertical * tangentLengthDerivative;
    const normalXDerivative = (
      normalNumeratorDerivative * centerDistanceSquared
        - normalNumerator * 2 * vertical
    ) / centerDistanceSquared ** 2;
    const travelPerShaftRadian = barrelRadiusDifference
      / (2 * normalX);
    const travelSecondDerivativePerShaftRadianSquared =
      -(barrelRadiusDifference ** 2) * normalXDerivative
        / (4 * normalX ** 3);
    return {
      centerDistance,
      fixedWrapSweep,
      freeLength,
      freeLengthDerivativeY: -2 * normalX,
      movingWrapSweep,
      normalAngle,
      normalX,
      normalXDerivative,
      normalY,
      tangentLength,
      travelPerShaftRadian,
      travelSecondDerivativePerShaftRadianSquared,
      vertical,
    };
  };

  const sourceFreeMetrics = freeMetricsAtMovingY(sourceMovingPulleyY);
  const sourceFreeRopeLength = sourceFreeMetrics.freeLength;
  const shaftAngleAmplitude = 2.25;
  const cyclePeriod = 8.4;
  const driveAngularFrequency = fullTurn / cyclePeriod;
  const baseLargeWrapTurns = 5.2;
  const baseSmallWrapTurns = 5.2;
  const baseLargeWoundLength = largeBarrelPitchRadius
    * fullTurn * baseLargeWrapTurns;
  const baseSmallWoundLength = smallBarrelPitchRadius
    * fullTurn * baseSmallWrapTurns;
  const nominalRopeLength = baseLargeWoundLength
    + sourceFreeRopeLength + baseSmallWoundLength;
  const ropeAxialPitch = 0.095;
  const markerCount = 11;
  const markerMaterialDistances = Array.from(
    { length: markerCount },
    (_, index) => baseLargeWoundLength
      + sourceFreeRopeLength * (index + 1) / (markerCount + 1),
  );

  const movingYAtShaftAngle = (shaftAngle) => {
    const targetFreeLength = sourceFreeRopeLength
      - barrelRadiusDifference * shaftAngle;
    let lower = sourceMovingPulleyY - 2.2;
    let upper = fixedGuideY;
    const lowerLength = freeMetricsAtMovingY(lower).freeLength;
    const upperLength = freeMetricsAtMovingY(upper).freeLength;
    if (targetFreeLength > lowerLength
      || targetFreeLength < upperLength) {
      throw new RangeError(
        'Movement 352 exhausted the geometrically valid load travel.',
      );
    }
    for (let iteration = 0; iteration < 72; iteration += 1) {
      const midpoint = (lower + upper) / 2;
      if (freeMetricsAtMovingY(midpoint).freeLength
        > targetFreeLength) {
        lower = midpoint;
      } else {
        upper = midpoint;
      }
    }
    const movingY = (lower + upper) / 2;
    return {
      metrics: freeMetricsAtMovingY(movingY),
      movingY,
      targetFreeLength,
    };
  };

  const ropeGeometryAtShaftAngle = (shaftAngle) => {
    const largeWoundLength = baseLargeWoundLength
      + largeBarrelPitchRadius * shaftAngle;
    const smallWoundLength = baseSmallWoundLength
      - smallBarrelPitchRadius * shaftAngle;
    if (largeWoundLength <= 0 || smallWoundLength <= 0) {
      throw new RangeError('Movement 352 exhausted a wound rope reserve.');
    }
    const solved = movingYAtShaftAngle(shaftAngle);
    const metrics = solved.metrics;
    const movingCenter = planePoint(0, solved.movingY);
    const leftNormal = planeVector(metrics.normalX, metrics.normalY);
    const rightNormal = planeVector(-metrics.normalX, metrics.normalY);
    const leftFixedInnerContact = leftFixedCenter.clone()
      .addScaledVector(leftNormal, fixedGuidePitchRadius);
    const rightFixedInnerContact = rightFixedCenter.clone()
      .addScaledVector(rightNormal, fixedGuidePitchRadius);
    const leftMovingContact = movingCenter.clone()
      .addScaledVector(leftNormal, -movingPulleyPitchRadius);
    const rightMovingContact = movingCenter.clone()
      .addScaledVector(rightNormal, -movingPulleyPitchRadius);

    const largeWrapSweep = largeWoundLength / largeBarrelPitchRadius;
    const smallWrapSweep = smallWoundLength / smallBarrelPitchRadius;
    const largeHelix = new WoundBarrelHelix({
      axialSpan: ropeAxialPitch * largeWrapSweep / fullTurn,
      exitPhase: Math.PI / 2,
      exitX: largeRopeExit.x,
      radius: largeBarrelPitchRadius,
      reverse: false,
      shaftY,
      wrapSweep: largeWrapSweep,
    });
    const largeVerticalLeg = new THREE.LineCurve3(
      largeRopeExit.clone(),
      leftOuterContact.clone(),
    );
    const leftFixedWrap = new CircularArcCurve3(
      leftFixedCenter,
      leftOuterContact.clone().sub(leftFixedCenter),
      pulleyAxis,
      -metrics.fixedWrapSweep,
    );
    const leftTangentLeg = new THREE.LineCurve3(
      leftFixedInnerContact.clone(),
      leftMovingContact.clone(),
    );
    const movingWrap = new CircularArcCurve3(
      movingCenter,
      leftMovingContact.clone().sub(movingCenter),
      pulleyAxis,
      metrics.movingWrapSweep,
    );
    const rightTangentLeg = new THREE.LineCurve3(
      rightMovingContact.clone(),
      rightFixedInnerContact.clone(),
    );
    const rightFixedWrap = new CircularArcCurve3(
      rightFixedCenter,
      rightFixedInnerContact.clone().sub(rightFixedCenter),
      pulleyAxis,
      -metrics.fixedWrapSweep,
    );
    const smallVerticalLeg = new THREE.LineCurve3(
      rightOuterContact.clone(),
      smallRopeExit.clone(),
    );
    const smallHelix = new WoundBarrelHelix({
      axialSpan: ropeAxialPitch * smallWrapSweep / fullTurn,
      exitPhase: -Math.PI / 2,
      exitX: smallRopeExit.x,
      radius: smallBarrelPitchRadius,
      reverse: true,
      shaftY,
      wrapSweep: smallWrapSweep,
    });
    const curves = [
      largeHelix,
      largeVerticalLeg,
      leftFixedWrap,
      leftTangentLeg,
      movingWrap,
      rightTangentLeg,
      rightFixedWrap,
      smallVerticalLeg,
      smallHelix,
    ];
    const segmentLengths = [
      largeWoundLength,
      verticalLegLength,
      fixedGuidePitchRadius * metrics.fixedWrapSweep,
      metrics.tangentLength,
      movingPulleyPitchRadius * metrics.movingWrapSweep,
      metrics.tangentLength,
      fixedGuidePitchRadius * metrics.fixedWrapSweep,
      verticalLegLength,
      smallWoundLength,
    ];
    const transitionDistances = [];
    let cumulative = 0;
    segmentLengths.slice(0, -1).forEach((length) => {
      cumulative += length;
      transitionDistances.push(cumulative);
    });
    const curve = new SegmentedMaterialRopeCurve(
      curves,
      segmentLengths,
      {
        largeHelix,
        largeVerticalLeg,
        leftFixedWrap,
        leftTangentLeg,
        movingWrap,
        rightTangentLeg,
        rightFixedWrap,
        smallVerticalLeg,
        smallHelix,
        transitionDistances,
      },
    );
    const transitionContinuity = curves.slice(0, -1).map(
      (segment, index) => {
        const next = curves[index + 1];
        const endPoint = segment.getPoint(1, new THREE.Vector3());
        const startPoint = next.getPoint(0, new THREE.Vector3());
        const endTangent = segment.getTangent(1, new THREE.Vector3());
        const startTangent = next.getTangent(0, new THREE.Vector3());
        return {
          pointError: endPoint.distanceTo(startPoint),
          tangentDot: THREE.MathUtils.clamp(
            endTangent.dot(startTangent),
            -1,
            1,
          ),
        };
      },
    );
    return {
      curve,
      curves,
      largeHelix,
      largeVerticalLeg,
      largeWoundLength,
      leftFixedWrap,
      leftFixedInnerContact,
      leftMovingContact,
      leftTangentLeg,
      metrics,
      movingCenter,
      movingWrap,
      rightFixedWrap,
      rightFixedInnerContact,
      rightMovingContact,
      rightTangentLeg,
      segmentLengths,
      smallHelix,
      smallVerticalLeg,
      smallWoundLength,
      transitionContinuity,
      transitionDistances,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.62,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.15,
    roughness: 0.66,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const frame = new THREE.Group();
  frame.userData.role =
    'fixed-A-frame-carrying-windlass-and-two-redirect-sheaves';
  // Brown draws the legs straight down past the shaft line; the shaft runs
  // in bearings seated on the legs' front faces, with no base, crossmember
  // or sheave posts.
  const frameRearZ = -0.33;
  const frameBottomY = -3.18;
  const frameCrownY = 3.72;
  // The legs and the arched head share one square section (0.22 in plane,
  // 0.27 deep): each leg's top 0.5 unit is part of the head piece, so the
  // arch runs into the legs with no gap or change of section.
  const legSection = { color: PALETTE.frame, depth: 0.27, thickness: 0.22 };
  const legTop = (side) => new THREE.Vector2(side * 0.66, frameCrownY - 0.32);
  const legFoot = (side) => new THREE.Vector2(side * 3.0, frameBottomY);
  const legAxis = (side) => legTop(side).sub(legFoot(side)).normalize();
  const legJoin = (side) => legTop(side).addScaledVector(legAxis(side), -0.5);
  const leftLeg = makeBeam(
    new THREE.Vector3(-3.0, frameBottomY, frameRearZ),
    new THREE.Vector3(legJoin(-1).x, legJoin(-1).y, frameRearZ),
    legSection,
  );
  leftLeg.userData.role = 'left-inclined-A-frame-leg';
  const rightLeg = makeBeam(
    new THREE.Vector3(3.0, frameBottomY, frameRearZ),
    new THREE.Vector3(legJoin(1).x, legJoin(1).y, frameRearZ),
    legSection,
  );
  rightLeg.userData.role = 'right-inclined-A-frame-leg';
  const crownCenter = [0, frameCrownY - 0.30];
  const crownMid = 0.66;
  const crownHalf = legSection.thickness / 2;
  const crownArc = [];
  for (let index = 0; index <= 48; index += 1) {
    const angle = Math.PI * index / 48;
    crownArc.push([crownCenter[0] + (crownMid + crownHalf) * Math.cos(angle),
      crownCenter[1] + (crownMid + crownHalf) * Math.sin(angle)]);
  }
  for (let index = 48; index >= 0; index -= 1) {
    const angle = Math.PI * index / 48;
    crownArc.push([crownCenter[0] + (crownMid - crownHalf) * Math.cos(angle),
      crownCenter[1] + (crownMid - crownHalf) * Math.sin(angle)]);
  }
  const legHead = (side) => {
    const axis = legAxis(side);
    const normal = new THREE.Vector2(-axis.y, axis.x).multiplyScalar(crownHalf);
    const low = legJoin(side);
    const high = legTop(side).addScaledVector(axis, 0.06);
    return [[[low.x + normal.x, low.y + normal.y],
      [high.x + normal.x, high.y + normal.y],
      [high.x - normal.x, high.y - normal.y],
      [low.x - normal.x, low.y - normal.y],
      [low.x + normal.x, low.y + normal.y]]];
  };
  const crown = new THREE.Mesh(
    plate(polygonClipping.union(
      [[[...crownArc, crownArc[0]]]],
      legHead(-1),
      legHead(1),
    ), frameRearZ - legSection.depth / 2, frameRearZ + legSection.depth / 2),
    leftLeg.children[0].material,
  );
  crown.userData.role = 'arched-A-frame-crown';
  // Each sheave hangs from a short hook bracket on the inside of its leg.
  const legXAtY = (y) => 3.0 - (y - frameBottomY)
    / (frameCrownY - 0.32 - frameBottomY) * (3.0 - 0.66);
  const hookY = fixedGuideY + 0.36;
  // The bracket arm ends in a bored eye that wraps the rear end of the
  // sheave axle (0.13 radius round the 0.065 axle, 0.20 long, 0.05 clear of
  // the sheave's rear face), so the arm joins the axle solidly instead of
  // touching its end face.
  const eyeCentreOffset = -0.25;
  const eyeLength = 0.20;
  const guideSupport = (side, center, role) => {
    const eyeCentre = center.clone().addScaledVector(pulleyAxis, eyeCentreOffset);
    const arm = makeBeam(
      new THREE.Vector3(side * (legXAtY(hookY) - 0.05), hookY, frameRearZ),
      eyeCentre,
      { color: PALETTE.frame, depth: 0.10, thickness: 0.09 },
    );
    let armMaterial = null;
    arm.traverse((child) => { if (child.isMesh && !armMaterial) armMaterial = child.material; });
    const eye = new THREE.Mesh(
      boredLatheGeometry([
        { axial: -eyeLength / 2, radial: 0.13 },
        { axial: eyeLength / 2, radial: 0.13 },
      ], 0.067, 96),
      armMaterial,
    );
    eye.quaternion.setFromUnitVectors(Y_AXIS, pulleyAxis);
    eye.position.copy(eyeCentre);
    eye.userData.role = `${role}-bored-eye`;
    const support = new THREE.Group();
    support.add(arm, eye);
    support.userData.role = role;
    support.userData.eye = eye;
    return support;
  };
  const leftGuideSupport = guideSupport(-1, leftFixedCenter,
    'left-fixed-sheave-support');
  const rightGuideSupport = guideSupport(1, rightFixedCenter,
    'right-fixed-sheave-support');
  frame.add(
    leftLeg,
    rightLeg,
    crown,
    leftGuideSupport,
    rightGuideSupport,
  );
  root.add(frame);

  const windlass = new THREE.Group();
  windlass.position.y = shaftY;
  windlass.userData.axis = X_AXIS.clone();
  windlass.userData.role =
    'fixed-axis-Chinese-windlass-with-two-unequal-rigid-barrels';
  const windlassRotor = new THREE.Group();
  windlassRotor.userData.role =
    'common-horizontal-shaft-and-both-barrels-one-rigid-input';
  windlass.add(windlassRotor);
  const shaftLength = 6.15;
  const shaftRadius = 0.10;
  const inputShaft = cylinderAlongX(
    shaftRadius,
    shaftLength,
    inkMaterial,
    30,
  );
  inputShaft.userData.role = 'common-horizontal-windlass-shaft';
  const largeBarrelWidth = 1.28;
  const smallBarrelWidth = 0.78;
  // Brown's large barrel runs on past the rope pack to the handspike.
  const largeBarrelExtension = 0.48;
  const largeBarrel = cylinderAlongX(
    largeBarrelPitchRadius - ropeRadius * 1.12,
    largeBarrelWidth + largeBarrelExtension,
    driverMaterial,
    52,
  );
  largeBarrel.position.x = largeRopeExit.x - largeBarrelExtension / 2;
  largeBarrel.userData.pitchRadius = largeBarrelPitchRadius;
  largeBarrel.userData.role = 'larger-winding-barrel';
  const smallBarrel = cylinderAlongX(
    smallBarrelPitchRadius - ropeRadius * 1.12,
    smallBarrelWidth,
    driverMaterial,
    46,
  );
  smallBarrel.position.x = smallRopeExit.x;
  smallBarrel.userData.pitchRadius = smallBarrelPitchRadius;
  smallBarrel.userData.role = 'smaller-unwinding-barrel';
  const barrelFlanges = [];
  for (const [centerX, width, radius, name] of [
    [largeRopeExit.x, largeBarrelWidth,
      largeBarrelPitchRadius, 'large'],
    [smallRopeExit.x, smallBarrelWidth,
      smallBarrelPitchRadius, 'small'],
  ]) {
    for (const side of [-1, 1]) {
      const flange = cylinderAlongX(
        radius + 0.12,
        0.085,
        driverMaterial,
        48,
      );
      flange.position.x = centerX + side * width / 2;
      flange.userData.role =
        `${name}-${side < 0 ? 'left' : 'right'}-barrel-flange`;
      barrelFlanges.push(flange);
    }
  }
  const shaftIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.50, 0.055),
    whiteMaterial,
  );
  shaftIndicator.position.set(
    largeRopeExit.x - largeBarrelWidth / 2 - 0.08,
    0.26,
    0,
  );
  shaftIndicator.userData.role = 'white-common-shaft-spin-index';
  // Brown turns the windlass by a handspike through the large barrel.
  // Brown's spike is about 2.3 barrel heights long, reaching down to the
  // feet of the A-frame; it is a slender bar, a little stouter here so it
  // reads as a lever.
  const crankRadius = 0.94;
  const handspikeX = largeRopeExit.x - largeBarrelWidth / 2
    - largeBarrelExtension + 0.2;
  const crankArm = makeBeam(
    new THREE.Vector3(handspikeX, -crankRadius, 0),
    new THREE.Vector3(handspikeX, crankRadius, 0),
    { color: PALETTE.frame, depth: 0.11, thickness: 0.11 },
  );
  crankArm.userData.role = 'handspike-through-large-barrel';
  windlassRotor.add(
    inputShaft,
    largeBarrel,
    smallBarrel,
    ...barrelFlanges,
    shaftIndicator,
    crankArm,
  );
  root.add(windlass);

  const makeRedirectPulley = (center, name) => {
    const pulley = makePulley({
      axis: pulleyAxis,
      color: PALETTE.driver,
      grooves: 1,
      radius: fixedGuidePitchRadius,
      spokes: 4,
      width: 0.28,
    });
    pulley.position.copy(center);
    pulley.userData.pitchRadius = fixedGuidePitchRadius;
    pulley.userData.role = `${name}-fixed-rope-redirect-sheave`;
    // The axle runs from the rear face of the bracket eye to just proud of
    // the sheave's front face (sheave half-width 0.09).
    const axleRear = eyeCentreOffset - eyeLength / 2;
    const axleFront = 0.12;
    const axle = makeShaft({
      axis: pulleyAxis,
      color: PALETTE.ink,
      length: axleFront - axleRear,
      radius: 0.065,
    });
    axle.position.copy(center)
      .addScaledVector(pulleyAxis, (axleFront + axleRear) / 2);
    axle.userData.role = `${name}-fixed-redirect-sheave-axle`;
    root.add(pulley, axle);
    return { axle, pulley };
  };
  const leftGuide = makeRedirectPulley(leftFixedCenter, 'left');
  const rightGuide = makeRedirectPulley(rightFixedCenter, 'right');

  const movingBlock = new THREE.Group();
  movingBlock.userData.axis = Y_AXIS.clone();
  movingBlock.userData.role =
    'vertically-translating-small-pulley-block-hook-and-load';
  const movingPulley = makePulley({
    axis: pulleyAxis,
    color: PALETTE.driven,
    grooves: 1,
    radius: movingPulleyPitchRadius,
    spokes: 3,
    width: 0.24,
  });
  movingPulley.userData.pitchRadius = movingPulleyPitchRadius;
  movingPulley.userData.role = 'small-moving-sheave-on-single-rope-bight';
  const movingAxle = makeShaft({
    axis: pulleyAxis,
    color: PALETTE.ink,
    // Just proud of the stirrup's two eyes.
    length: 0.38,
    radius: 0.052,
  });
  movingAxle.userData.role = 'moving-load-sheave-axle';
  // Brown hangs the load from an ordinary hook under the moving sheave. The
  // ironwork lies in the sheave's own frame (x along the rope plane, z along
  // the axle): a round-bar stirrup rides the axle ends by two closed eyes and
  // passes under the rim; the hook's closed eye links round the stirrup's
  // bottom bar; one smooth round shank curves into the bowl, whose tip ends in
  // a hemispherical cap; the load's cast bail hangs in the bowl bottom.
  const ironMaterial = drivenMaterial;
  const hangerFrame = new THREE.Group();
  hangerFrame.quaternion.setFromRotationMatrix(new THREE.Matrix4()
    .makeBasis(planeHorizontal, Y_AXIS, pulleyAxis));
  hangerFrame.userData.role = 'moving-sheave-hook-ironwork-in-rope-plane';
  const stirrupRadius = 0.03;
  const stirrupEyeRadius = 0.088;
  const stirrupEyeTube = 0.034;
  // The working sheave (made by correctCordTraverseParts) is 0.16 wide.
  const stirrupHalfSpan = 0.14;
  const stirrupBottomY = -0.24;
  const stirrupCorner = 0.06;
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const stirrupPath = new THREE.CurvePath();
  const stirrupLegTop = -stirrupEyeRadius;
  stirrupPath.add(new THREE.LineCurve3(v3(0, stirrupLegTop, stirrupHalfSpan),
    v3(0, stirrupBottomY + stirrupCorner, stirrupHalfSpan)));
  stirrupPath.add(new THREE.QuadraticBezierCurve3(
    v3(0, stirrupBottomY + stirrupCorner, stirrupHalfSpan),
    v3(0, stirrupBottomY, stirrupHalfSpan),
    v3(0, stirrupBottomY, stirrupHalfSpan - stirrupCorner)));
  stirrupPath.add(new THREE.LineCurve3(
    v3(0, stirrupBottomY, stirrupHalfSpan - stirrupCorner),
    v3(0, stirrupBottomY, -stirrupHalfSpan + stirrupCorner)));
  stirrupPath.add(new THREE.QuadraticBezierCurve3(
    v3(0, stirrupBottomY, -stirrupHalfSpan + stirrupCorner),
    v3(0, stirrupBottomY, -stirrupHalfSpan),
    v3(0, stirrupBottomY + stirrupCorner, -stirrupHalfSpan)));
  stirrupPath.add(new THREE.LineCurve3(
    v3(0, stirrupBottomY + stirrupCorner, -stirrupHalfSpan),
    v3(0, stirrupLegTop, -stirrupHalfSpan)));
  const stirrupGeometry = () =>
    new THREE.TubeGeometry(stirrupPath, 96, stirrupRadius, 16, false);
  const hanger = new THREE.Mesh(stirrupGeometry(), ironMaterial);
  hanger.userData.role = 'round-bar-stirrup-riding-moving-sheave-axle';
  const stirrupEyes = [-1, 1].map((side) => {
    const eye = new THREE.Mesh(
      new THREE.TorusGeometry(stirrupEyeRadius, stirrupEyeTube, 16, 48),
      ironMaterial,
    );
    eye.position.z = side * stirrupHalfSpan;
    eye.userData.role = `stirrup-${side < 0 ? 'rear' : 'front'}-eye-on-moving-axle`;
    return eye;
  });
  // Hook: closed eye round the stirrup bar, then one smooth round bar.
  const hookBar = 0.045;
  const hookEyeRadius = 0.085;
  const hookEyeTube = 0.034;
  // The eye's inner crown rests 0.004 above the stirrup bar's top.
  const hookEyeCentreY = stirrupBottomY + stirrupRadius
    - (hookEyeRadius - hookEyeTube) + 0.004;
  const bowlRadius = 0.11;
  const bowlCentreY = -0.80;
  const shankTop = v3(0, hookEyeCentreY - hookEyeRadius, 0);
  const hookPath = new THREE.CurvePath();
  hookPath.add(new THREE.LineCurve3(shankTop.clone().add(v3(0, 0.02, 0)),
    v3(0, hookEyeCentreY - hookEyeRadius - 0.08, 0)));
  hookPath.add(new THREE.CubicBezierCurve3(
    v3(0, hookEyeCentreY - hookEyeRadius - 0.08, 0),
    v3(0, bowlCentreY + 0.20, 0),
    v3(-bowlRadius, bowlCentreY + 0.20, 0),
    v3(-bowlRadius, bowlCentreY, 0)));
  const bowlEndAngle = 2 * Math.PI + 0.55;
  hookPath.add(new CircularArcCurve3(v3(0, bowlCentreY, 0),
    v3(-bowlRadius, 0, 0), v3(0, 0, 1), bowlEndAngle - Math.PI));
  const hookShank = new THREE.Mesh(
    new THREE.TubeGeometry(hookPath, 160, hookBar, 18, false),
    ironMaterial,
  );
  hookShank.userData.role = 'load-hook-shank-and-bowl';
  const hookEye = new THREE.Mesh(
    new THREE.TorusGeometry(hookEyeRadius, hookEyeTube, 16, 48),
    ironMaterial,
  );
  hookEye.position.y = hookEyeCentreY;
  hookEye.userData.role = 'load-hook-closed-eye-on-stirrup-bar';
  const hookTip = new THREE.Mesh(
    new THREE.SphereGeometry(hookBar, 18, 12),
    ironMaterial,
  );
  hookTip.position.set(bowlRadius * Math.cos(bowlEndAngle),
    bowlCentreY + bowlRadius * Math.sin(bowlEndAngle), 0);
  hookTip.userData.role = 'load-hook-rounded-tip-cap';
  const hook = new THREE.Group();
  hook.add(hookEye, hookShank, hookTip);
  hook.userData.role = 'load-hook-below-moving-pulley-block';
  // The load's bail lies across the hook plane and rests on the bowl bottom.
  const bailRadius = 0.08;
  const bailTube = 0.026;
  const bailCentreY = bowlCentreY - bowlRadius + hookBar
    - (bailRadius - bailTube) + 0.003;
  const bail = new THREE.Mesh(
    new THREE.TorusGeometry(bailRadius, bailTube, 16, 48),
    ironMaterial,
  );
  bail.rotation.y = Math.PI / 2;
  bail.position.y = bailCentreY;
  bail.userData.role = 'load-bail-hanging-in-hook-bowl';
  const loadHeight = 0.72;
  const load = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.43, loadHeight, 36),
    drivenMaterial,
  );
  // The bail's foot is cast into the load's top, which stays clear of the
  // hook's bowl.
  load.position.y = bailCentreY - bailRadius + 0.025 - loadHeight / 2;
  load.userData.role = 'suspended-load-carried-by-moving-bight';
  hangerFrame.add(hanger, ...stirrupEyes, hook, bail, load);
  movingBlock.add(movingPulley, movingAxle, hangerFrame);
  root.add(movingBlock);

  const shaftBearings = [-2.58, 2.58].map((x, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.20, 0.055, 10, 38),
      frameMaterial,
    );
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(x, shaftY, -0.01);
    bearing.userData.role =
      `${index === 0 ? 'left' : 'right'}-fixed-windlass-shaft-bearing`;
    root.add(bearing);
    return bearing;
  });

  const sourceRopeGeometry = ropeGeometryAtShaftAngle(0);
  // Brown draws the rope laid: the shared three-strand rope, its lay fixed in
  // the material from the curve's anchored start, shows the travel.
  const rope = makeDynamicMovingBelt(sourceRopeGeometry.curve, {
    closed: false,
    color: PALETTE.rope,
    laid: true,
    markerCount: 0,
    radius: ropeRadius,
    tubularSegments: 640,
  });
  rope.userData.physicalCable = true;
  rope.userData.ropeCount = 1;
  rope.userData.role =
    'one-continuous-rope-large-barrel-left-guide-moving-bight-right-guide-small-barrel';
  const ropeMesh = rope.children[0];
  ropeMesh.userData.role = 'single-tangent-continuous-windlass-rope-mesh';
  const ropeMarkers = markerMaterialDistances.map((distance, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(ropeRadius * 1.62, 12, 9),
      whiteMaterial,
    );
    marker.position.copy(sourceRopeGeometry.curve.getPointAtDistance(
      distance,
    ));
    marker.userData.materialDistance = distance;
    marker.userData.markerIndex = index;
    marker.userData.role = 'white-Lagrangian-marker-on-single-rope';
    // Kept as a material reference; the laid rope's lay shows the travel.
    marker.visible = false;
    rope.add(marker);
    return marker;
  });
  rope.userData.markers = ropeMarkers;

  const contactMarkers = [
    largeRopeExit,
    leftOuterContact,
    sourceRopeGeometry.leftFixedInnerContact,
    sourceRopeGeometry.leftMovingContact,
    sourceRopeGeometry.rightMovingContact,
    sourceRopeGeometry.rightFixedInnerContact,
    rightOuterContact,
    smallRopeExit,
  ].map((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.047, 16, 10),
      whiteMaterial,
    );
    marker.position.copy(point);
    marker.userData.index = index;
    marker.userData.role = 'white-rope-tangency-contact-marker';
    root.add(marker);
    return marker;
  });
  root.add(rope);

  const stateAtShaftKinematics = ({
    drivePhase = null,
    shaftAngle,
    shaftAngularAcceleration,
    shaftAngularVelocity,
  }) => {
    const ropeGeometry = ropeGeometryAtShaftAngle(shaftAngle);
    const metrics = ropeGeometry.metrics;
    const movingPulleyVelocityY = metrics.travelPerShaftRadian
      * shaftAngularVelocity;
    const movingPulleyAccelerationY =
      metrics.travelSecondDerivativePerShaftRadianSquared
        * shaftAngularVelocity ** 2
      + metrics.travelPerShaftRadian * shaftAngularAcceleration;
    const leftGuideAngle = largeBarrelPitchRadius * shaftAngle
      / fixedGuidePitchRadius;
    const leftGuideAngularVelocity = largeBarrelPitchRadius
      * shaftAngularVelocity / fixedGuidePitchRadius;
    const leftGuideAngularAcceleration = largeBarrelPitchRadius
      * shaftAngularAcceleration / fixedGuidePitchRadius;
    const rightGuideAngle = smallBarrelPitchRadius * shaftAngle
      / fixedGuidePitchRadius;
    const rightGuideAngularVelocity = smallBarrelPitchRadius
      * shaftAngularVelocity / fixedGuidePitchRadius;
    const rightGuideAngularAcceleration = smallBarrelPitchRadius
      * shaftAngularAcceleration / fixedGuidePitchRadius;
    const movingPulleyAngle = -barrelRadiusSum * shaftAngle
      / (2 * movingPulleyPitchRadius);
    const movingPulleyAngularVelocity = -barrelRadiusSum
      * shaftAngularVelocity / (2 * movingPulleyPitchRadius);
    const movingPulleyAngularAcceleration = -barrelRadiusSum
      * shaftAngularAcceleration / (2 * movingPulleyPitchRadius);
    const leftMaterialSpeed = -largeBarrelPitchRadius
      * shaftAngularVelocity;
    const rightMaterialSpeed = -smallBarrelPitchRadius
      * shaftAngularVelocity;
    const shaftAngularVelocityVector = X_AXIS.clone().multiplyScalar(
      shaftAngularVelocity,
    );
    const largeDrumContactRadius = new THREE.Vector3(
      0,
      0,
      largeBarrelPitchRadius,
    );
    const smallDrumContactRadius = new THREE.Vector3(
      0,
      0,
      -smallBarrelPitchRadius,
    );
    const largeDrumSurfaceVelocity = new THREE.Vector3().crossVectors(
      shaftAngularVelocityVector,
      largeDrumContactRadius,
    );
    const smallDrumSurfaceVelocity = new THREE.Vector3().crossVectors(
      shaftAngularVelocityVector,
      smallDrumContactRadius,
    );
    const largeRopeVelocity = ropeGeometry.largeVerticalLeg
      .getTangent(0, new THREE.Vector3())
      .multiplyScalar(leftMaterialSpeed);
    const smallRopeVelocity = ropeGeometry.smallVerticalLeg
      .getTangent(1, new THREE.Vector3())
      .multiplyScalar(rightMaterialSpeed);

    const leftGuideAngularVelocityVector = pulleyAxis.clone()
      .multiplyScalar(leftGuideAngularVelocity);
    const rightGuideAngularVelocityVector = pulleyAxis.clone()
      .multiplyScalar(rightGuideAngularVelocity);
    const movingAngularVelocityVector = pulleyAxis.clone()
      .multiplyScalar(movingPulleyAngularVelocity);
    const movingCenterVelocity = Y_AXIS.clone().multiplyScalar(
      movingPulleyVelocityY,
    );
    const surfaceAt = (centerVelocity, angularVelocity, point, center) =>
      centerVelocity.clone().add(new THREE.Vector3().crossVectors(
        angularVelocity,
        point.clone().sub(center),
      ));
    const materialAt = (curve, fraction, scalarSpeed) => curve
      .getTangent(fraction, new THREE.Vector3())
      .multiplyScalar(scalarSpeed);
    const tangentialNoSlipError = (
      surfaceVelocity,
      curve,
      fraction,
      scalarSpeed,
    ) => {
      const tangent = curve.getTangent(fraction, new THREE.Vector3());
      return tangent.multiplyScalar(
        surfaceVelocity.dot(tangent) - scalarSpeed,
      );
    };
    const zeroVelocity = new THREE.Vector3();
    const leftOuterSurfaceVelocity = surfaceAt(
      zeroVelocity,
      leftGuideAngularVelocityVector,
      leftOuterContact,
      leftFixedCenter,
    );
    const leftInnerSurfaceVelocity = surfaceAt(
      zeroVelocity,
      leftGuideAngularVelocityVector,
      ropeGeometry.leftFixedInnerContact,
      leftFixedCenter,
    );
    const rightInnerSurfaceVelocity = surfaceAt(
      zeroVelocity,
      rightGuideAngularVelocityVector,
      ropeGeometry.rightFixedInnerContact,
      rightFixedCenter,
    );
    const rightOuterSurfaceVelocity = surfaceAt(
      zeroVelocity,
      rightGuideAngularVelocityVector,
      rightOuterContact,
      rightFixedCenter,
    );
    const leftMovingSurfaceVelocity = surfaceAt(
      movingCenterVelocity,
      movingAngularVelocityVector,
      ropeGeometry.leftMovingContact,
      ropeGeometry.movingCenter,
    );
    const rightMovingSurfaceVelocity = surfaceAt(
      movingCenterVelocity,
      movingAngularVelocityVector,
      ropeGeometry.rightMovingContact,
      ropeGeometry.movingCenter,
    );
    const freeRopeLengthRate = -barrelRadiusDifference
      * shaftAngularVelocity;
    const ropeLengthRateError = largeBarrelPitchRadius
      * shaftAngularVelocity
      - smallBarrelPitchRadius * shaftAngularVelocity
      + freeRopeLengthRate;
    return {
      drivePhase,
      freeRopeLength: metrics.freeLength,
      freeRopeLengthError: metrics.freeLength
        - (sourceFreeRopeLength - barrelRadiusDifference * shaftAngle),
      freeRopeLengthRate,
      largeDrumNoSlipError: largeDrumSurfaceVelocity.clone()
        .sub(largeRopeVelocity),
      largeDrumSurfaceVelocity,
      largeRopeVelocity,
      largeWoundLength: ropeGeometry.largeWoundLength,
      largeWoundTurns: ropeGeometry.largeWoundLength
        / (fullTurn * largeBarrelPitchRadius),
      leftFixedInnerContact: ropeGeometry.leftFixedInnerContact.clone(),
      leftFixedInnerNoSlipError: leftInnerSurfaceVelocity.clone().sub(
        materialAt(ropeGeometry.leftFixedWrap, 1, leftMaterialSpeed),
      ),
      leftFixedOuterContact: leftOuterContact.clone(),
      leftFixedOuterNoSlipError: leftOuterSurfaceVelocity.clone().sub(
        materialAt(ropeGeometry.leftFixedWrap, 0, leftMaterialSpeed),
      ),
      leftGuideAcceleration: leftGuideAngularAcceleration,
      leftGuideAngle,
      leftGuideAngularVelocity,
      leftMaterialSpeed,
      leftMovingContact: ropeGeometry.leftMovingContact.clone(),
      leftMovingNoSlipError: tangentialNoSlipError(
        leftMovingSurfaceVelocity,
        ropeGeometry.movingWrap,
        0,
        leftMaterialSpeed,
      ),
      movingPulleyAcceleration: Y_AXIS.clone().multiplyScalar(
        movingPulleyAccelerationY,
      ),
      movingPulleyAccelerationY,
      movingPulleyAngle,
      movingPulleyAngularAcceleration,
      movingPulleyAngularVelocity,
      movingPulleyCenter: ropeGeometry.movingCenter.clone(),
      movingPulleyVelocity: movingCenterVelocity.clone(),
      movingPulleyVelocityY,
      nominalRopeLength,
      rightFixedInnerContact: ropeGeometry.rightFixedInnerContact.clone(),
      rightFixedInnerNoSlipError: rightInnerSurfaceVelocity.clone().sub(
        materialAt(ropeGeometry.rightFixedWrap, 0, rightMaterialSpeed),
      ),
      rightFixedOuterContact: rightOuterContact.clone(),
      rightFixedOuterNoSlipError: rightOuterSurfaceVelocity.clone().sub(
        materialAt(ropeGeometry.rightFixedWrap, 1, rightMaterialSpeed),
      ),
      rightGuideAcceleration: rightGuideAngularAcceleration,
      rightGuideAngle,
      rightGuideAngularVelocity,
      rightMaterialSpeed,
      rightMovingContact: ropeGeometry.rightMovingContact.clone(),
      rightMovingNoSlipError: tangentialNoSlipError(
        rightMovingSurfaceVelocity,
        ropeGeometry.movingWrap,
        1,
        rightMaterialSpeed,
      ),
      ropeCurve: ropeGeometry.curve,
      ropeLength: ropeGeometry.curve.getLength(),
      ropeLengthError: ropeGeometry.curve.getLength()
        - nominalRopeLength,
      ropeLengthRateError,
      ropeSegmentLengths: ropeGeometry.segmentLengths,
      ropeTransitionContinuity: ropeGeometry.transitionContinuity,
      ropeTransitionDistances: ropeGeometry.transitionDistances,
      shaftAngle,
      shaftAngularAcceleration,
      shaftAngularVelocity,
      smallDrumNoSlipError: smallDrumSurfaceVelocity.clone()
        .sub(smallRopeVelocity),
      smallDrumSurfaceVelocity,
      smallRopeVelocity,
      smallWoundLength: ropeGeometry.smallWoundLength,
      smallWoundTurns: ropeGeometry.smallWoundLength
        / (fullTurn * smallBarrelPitchRadius),
      stage: Math.abs(shaftAngularVelocity) < 1e-10
        ? shaftAngularAcceleration < 0
          ? 'windlass-reverses-at-raised-load-limit'
          : 'windlass-reverses-at-lowered-load-limit'
        : movingPulleyVelocityY > 0
          ? 'large-barrel-winds-small-barrel-unwinds-load-rises'
          : 'large-barrel-unwinds-small-barrel-winds-load-descends',
      tangentMetrics: metrics,
      velocityDiscontinuous: false,
    };
  };

  const stateAtTime = (time) => {
    const drivePhase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    const driveAngle = fullTurn * drivePhase;
    const shaftAngle = shaftAngleAmplitude * Math.sin(driveAngle);
    const shaftAngularVelocity = shaftAngleAmplitude
      * driveAngularFrequency * Math.cos(driveAngle);
    const shaftAngularAcceleration = -shaftAngleAmplitude
      * driveAngularFrequency ** 2 * Math.sin(driveAngle);
    return stateAtShaftKinematics({
      drivePhase,
      shaftAngle,
      shaftAngularAcceleration,
      shaftAngularVelocity,
    });
  };
  const ropeMaterialPointAtTime = (time, materialDistance) =>
    stateAtTime(time).ropeCurve.getPointAtDistance(materialDistance);
  const canonicalTimes = {
    sourcePoseRising: 0,
    raisedReversal: cyclePeriod / 4,
    sourcePoseDescending: cyclePeriod / 2,
    loweredReversal: 3 * cyclePeriod / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const contacts = {
    largeBarrelRope: {
      contactPoint: largeRopeExit.clone(),
      noSlipError: new THREE.Vector3(),
      pitchRadius: largeBarrelPitchRadius,
      type: 'winding-contact-on-larger-common-shaft-barrel',
      woundLength: 0,
    },
    leftFixedGuideRope: {
      innerContactPoint: new THREE.Vector3(),
      innerNoSlipError: new THREE.Vector3(),
      outerContactPoint: leftOuterContact.clone(),
      outerNoSlipError: new THREE.Vector3(),
      pitchRadius: fixedGuidePitchRadius,
      pulley: leftGuide.pulley,
      type: 'rope-wrap-on-left-fixed-redirect-sheave',
    },
    movingPulleyRope: {
      leftContactPoint: new THREE.Vector3(),
      leftNoSlipError: new THREE.Vector3(),
      pitchRadius: movingPulleyPitchRadius,
      pulley: movingPulley,
      rightContactPoint: new THREE.Vector3(),
      rightNoSlipError: new THREE.Vector3(),
      type: 'single-rope-bight-under-moving-load-sheave',
    },
    rightFixedGuideRope: {
      innerContactPoint: new THREE.Vector3(),
      innerNoSlipError: new THREE.Vector3(),
      outerContactPoint: rightOuterContact.clone(),
      outerNoSlipError: new THREE.Vector3(),
      pitchRadius: fixedGuidePitchRadius,
      pulley: rightGuide.pulley,
      type: 'rope-wrap-on-right-fixed-redirect-sheave',
    },
    ropeLength: {
      count: 1,
      error: 0,
      nominalLength: nominalRopeLength,
      rateError: 0,
      type: 'one-inextensible-continuous-rope',
    },
    smallBarrelRope: {
      contactPoint: smallRopeExit.clone(),
      noSlipError: new THREE.Vector3(),
      pitchRadius: smallBarrelPitchRadius,
      type: 'unwinding-contact-on-smaller-common-shaft-barrel',
      woundLength: 0,
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    windlassRotor.rotation.set(state.shaftAngle, 0, 0);
    windlass.userData.angularVelocity = state.shaftAngularVelocity;
    windlass.userData.angularAcceleration =
      state.shaftAngularAcceleration;
    setSpin(leftGuide.pulley, state.leftGuideAngle);
    leftGuide.pulley.userData.angularVelocity =
      state.leftGuideAngularVelocity;
    setSpin(rightGuide.pulley, state.rightGuideAngle);
    rightGuide.pulley.userData.angularVelocity =
      state.rightGuideAngularVelocity;
    movingBlock.position.copy(state.movingPulleyCenter);
    movingBlock.userData.velocity = state.movingPulleyVelocity.clone();
    movingBlock.userData.acceleration =
      state.movingPulleyAcceleration.clone();
    setSpin(movingPulley, state.movingPulleyAngle);
    movingPulley.userData.angularVelocity =
      state.movingPulleyAngularVelocity;
    movingPulley.userData.angularAcceleration =
      state.movingPulleyAngularAcceleration;
    rope.userData.setCurve(state.ropeCurve);
    ropeMarkers.forEach((marker, index) => {
      marker.position.copy(state.ropeCurve.getPointAtDistance(
        markerMaterialDistances[index],
      ));
    });
    const dynamicContacts = [
      state.leftFixedInnerContact,
      state.leftMovingContact,
      state.rightMovingContact,
      state.rightFixedInnerContact,
    ];
    dynamicContacts.forEach((point, index) => {
      contactMarkers[index + 2].position.copy(point);
    });
    contacts.largeBarrelRope.noSlipError.copy(
      state.largeDrumNoSlipError,
    );
    contacts.largeBarrelRope.woundLength = state.largeWoundLength;
    contacts.smallBarrelRope.noSlipError.copy(
      state.smallDrumNoSlipError,
    );
    contacts.smallBarrelRope.woundLength = state.smallWoundLength;
    contacts.leftFixedGuideRope.innerContactPoint.copy(
      state.leftFixedInnerContact,
    );
    contacts.leftFixedGuideRope.innerNoSlipError.copy(
      state.leftFixedInnerNoSlipError,
    );
    contacts.leftFixedGuideRope.outerNoSlipError.copy(
      state.leftFixedOuterNoSlipError,
    );
    contacts.rightFixedGuideRope.innerContactPoint.copy(
      state.rightFixedInnerContact,
    );
    contacts.rightFixedGuideRope.innerNoSlipError.copy(
      state.rightFixedInnerNoSlipError,
    );
    contacts.rightFixedGuideRope.outerNoSlipError.copy(
      state.rightFixedOuterNoSlipError,
    );
    contacts.movingPulleyRope.leftContactPoint.copy(
      state.leftMovingContact,
    );
    contacts.movingPulleyRope.leftNoSlipError.copy(
      state.leftMovingNoSlipError,
    );
    contacts.movingPulleyRope.rightContactPoint.copy(
      state.rightMovingContact,
    );
    contacts.movingPulleyRope.rightNoSlipError.copy(
      state.rightMovingNoSlipError,
    );
    contacts.ropeLength.error = state.ropeLengthError;
    contacts.ropeLength.rateError = state.ropeLengthRateError;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'redirected-single-rope-Chinese-differential-windlass';
  root.userData.blocks = {
    barrelFlanges,
    contactMarkers,
    crankArm,
    crown,
    frame,
    hanger,
    hangerFrame,
    hook,
    hookEye,
    hookShank,
    hookTip,
    bail,
    stirrupEyes,
    inputShaft,
    largeBarrel,
    leftGuide,
    leftGuideSupport,
    leftLeg,
    load,
    movingAxle,
    movingBlock,
    movingPulley,
    rightGuide,
    rightGuideSupport,
    rightLeg,
    rope,
    ropeMarkers,
    ropeMesh,
    shaftBearings,
    shaftIndicator,
    smallBarrel,
    windlass,
    windlassRotor,
  };
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.42, -3.42, -1.2),
    new THREE.Vector3(3.42, 4.02, 1.15),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one reversible common horizontal windlass shaft',
    mechanism: 1,
    output:
      'one vertically translating load block carried by the single rope bight',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    axis: X_AXIS.clone(),
    barrelRadiusDifference,
    barrelRadiusSum,
    baseLargeWoundLength,
    baseLargeWrapTurns,
    baseSmallWoundLength,
    baseSmallWrapTurns,
    crankRadius,
    cyclePeriod,
    driveAngularFrequency,
    exitHalfSpacing,
    exitMidpoint: exitMidpoint.clone(),
    exitSeparation: exitSeparation.clone(),
    fixedCenterPlaneX,
    fixedGuidePitchRadius,
    fixedGuideY,
    frameBottomY,
    frameCrownY,
    frameRearZ,
    fullTurn,
    largeBarrelPitchRadius,
    largeBarrelWidth,
    largeRopeExit: largeRopeExit.clone(),
    leftFixedCenter: leftFixedCenter.clone(),
    leftOuterContact: leftOuterContact.clone(),
    markerCount,
    markerMaterialDistances,
    movingPulleyPitchRadius,
    nominalRopeLength,
    planeHorizontal: planeHorizontal.clone(),
    pulleyAxis: pulleyAxis.clone(),
    rightFixedCenter: rightFixedCenter.clone(),
    rightOuterContact: rightOuterContact.clone(),
    ropeAxialPitch,
    ropeRadius,
    shaftAngleAmplitude,
    shaftLength,
    shaftRadius,
    shaftY,
    smallBarrelPitchRadius,
    smallBarrelWidth,
    smallRopeExit: smallRopeExit.clone(),
    sourceFreeRopeLength,
    sourceMovingPulleyY,
    sourceScale,
    verticalLegLength,
  };
  root.userData.mechanism =
    'one-continuous-rope-winds-on-the-larger-and-unwinds-from-the-smaller-of-two-rigid-coaxial-barrels-rises-over-a-left-fixed-redirect-wraps-under-one-small-moving-load-sheave-rises-over-a-right-fixed-redirect-and-returns-to-the-smaller-barrel-with-exact-three-dimensional-tangencies-constant-length-and-no-slip-spin-rates';
  root.userData.movingYAtShaftAngle = movingYAtShaftAngle;
  root.userData.ropeGeometryAtShaftAngle = ropeGeometryAtShaftAngle;
  root.userData.ropeMaterialPointAtTime = ropeMaterialPointAtTime;
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    pageMarksAnimationUnavailable: true,
    presentationTiming: {
      durationSeconds: cyclePeriod,
      reversibleSineDrive: true,
      sourcePrescribed: false,
    },
    referenceMovement129: {
      law:
        'with parallel support legs, pulley travel per revolution is half the difference between the two barrel circumferences',
      sourceUrl: 'https://507movements.com/mm_129.html',
    },
    referenceScope:
      'engraving topology, A-frame, lower compound barrel, two upper redirect sheaves, one small moving sheave and load on the bight, opposite barrel winding, and one continuous rope',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate352: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one rope connects unequal coaxial lower barrels through two fixed upper redirects and beneath one small central moving load sheave',
      measurementUncertaintyPixels: 7,
      rasterFixedGuideRadius: sourceRasterFixedGuideRadius,
      rasterFrameCrown: sourceRasterFrameCrown,
      rasterLargeBarrelRadius: sourceRasterLargeBarrelRadius,
      rasterLargeRopeX: sourceRasterLargeRopeX,
      rasterLeftFrameFoot: sourceRasterLeftFrameFoot,
      rasterLeftGuideCenter: sourceRasterLeftGuideCenter,
      rasterMovingPulleyCenter: sourceRasterMovingPulleyCenter,
      rasterMovingPulleyRadius: sourceRasterMovingPulleyRadius,
      rasterRightFrameFoot: sourceRasterRightFrameFoot,
      rasterRightGuideCenter: sourceRasterRightGuideCenter,
      rasterShaftCenter: sourceRasterShaftCenter,
      rasterSmallBarrelRadius: sourceRasterSmallBarrelRadius,
      rasterSmallRopeX: sourceRasterSmallRopeX,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtShaftKinematics = stateAtShaftKinematics;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    constantLengthConstraint:
      'large wound length + free nine-segment rope path + small wound length = one nominal rope length',
    movingPulleySpin:
      'omega_moving = -(R_large + R_small) omega_shaft / (2 r_moving)',
    nonlinearRedirectedTravel:
      'dy/dtheta = (R_large - R_small)/(2 n_x), where n_x is the horizontal component of the internal-tangent normal',
    referenceParallelLegTravelPerRevolution:
      'pi (R_large - R_small)',
    referenceParallelLegTravelPerRevolutionValue:
      Math.PI * barrelRadiusDifference,
  };

  update(0);
  correctCordTraverseParts(root,352,update);
  // The shared correction still resizes the old box hanger; restore the
  // round-bar stirrup in its own frame.
  hanger.geometry.dispose();
  hanger.geometry = stirrupGeometry();
  hanger.position.set(0, 0, 0);
  markShadows(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredRedirectedWindlassMovement(movement) {
  if (movement.id !== 352) return null;
  return redirectedChineseWindlass(movement);
}
