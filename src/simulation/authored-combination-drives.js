import * as THREE from 'three';
import {
  CircularArcCurve3,
  PALETTE,
  makeDynamicLink,
  makeDynamicMovingBelt,
  markShadows,
  matte,
} from './primitives.js';

import {foldingRod} from './folding-joint-parts.js';
import {fitPistonGuide} from './piston-guide-parts.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedAngle(unwrappedAngle) {
  const turns = unwrappedAngle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-12) return 0;
  return positiveModulo(unwrappedAngle, FULL_TURN);
}

function signedAngularDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

function cylinderAlongZ(radius, depth, material, segments = 52) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function tangentFromPointToCircle(point, center, radius) {
  const offset = point.clone().sub(center);
  const distanceSquared = offset.lengthSq();
  if (distanceSquared <= radius ** 2) {
    throw new RangeError('Cord endpoint entered moving pulley pitch circle.');
  }
  const base = offset.clone().multiplyScalar(radius ** 2 / distanceSquared);
  const side = new THREE.Vector2(-offset.y, offset.x).multiplyScalar(
    radius * Math.sqrt(distanceSquared - radius ** 2) / distanceSquared,
  );
  const candidates = [
    center.clone().add(base).add(side),
    center.clone().add(base).sub(side),
  ];
  candidates.sort((left, right) => left.x - right.x);
  return candidates[0];
}

function internalTangentBetweenCircles(
  upperCenter,
  upperRadius,
  lowerCenter,
  lowerRadius,
) {
  const delta = lowerCenter.clone().sub(upperCenter);
  const distanceSquared = delta.lengthSq();
  const signedLowerRadius = -lowerRadius;
  const radiusDifference = upperRadius - signedLowerRadius;
  const heightSquared = distanceSquared - radiusDifference ** 2;
  if (heightSquared <= 0) {
    throw new RangeError('Moving pulley and drum lost their internal tangent.');
  }
  const height = Math.sqrt(heightSquared);
  const normal = new THREE.Vector2(
    (
      delta.x * radiusDifference - delta.y * height
    ) / distanceSquared,
    (
      delta.y * radiusDifference + delta.x * height
    ) / distanceSquared,
  );
  return {
    drumTangent: lowerCenter.clone().addScaledVector(
      normal,
      signedLowerRadius,
    ),
    pulleyTangent: upperCenter.clone().addScaledVector(
      normal,
      upperRadius,
    ),
  };
}

class DrumHelixCurve extends THREE.Curve {
  constructor({
    axialAdvancePerRadian,
    center,
    radialStart,
    sweep,
  }) {
    super();
    this.axialAdvancePerRadian = axialAdvancePerRadian;
    this.center = center.clone();
    this.radialStart = radialStart.clone();
    this.sweep = sweep;
  }

  getPoint(progress, target = new THREE.Vector3()) {
    const radial = this.radialStart.clone().applyAxisAngle(
      Z_AXIS,
      this.sweep * progress,
    );
    return target.copy(this.center).add(radial).setZ(
      this.center.z
        - this.axialAdvancePerRadian * Math.abs(this.sweep) * progress,
    );
  }
}

function combinationWeightDrive(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.8);

  const diskCenter = new THREE.Vector2(0, -1.75);
  const fixedPivotG = new THREE.Vector2(1.7, 2.28);
  const crankRadius = 0.65;
  const rockerJointRadius = 2;
  const couplerLength = 4;
  const pulleyArmRadius = 3.1;
  const diskRadius = 0.83;
  // Brown draws the drum as a bold circle on B's front face (about 27 px
  // against his 49 px crank radius) with a small axle circle (about 10 px)
  // at its centre; cord D comes down onto the drum's left side.
  const diskHubRadius = 0.13;
  const drumRadius = 0.35;
  const drumAxialAdvancePerRadian = 0.014;
  const effectiveDrumTakeupRadius = Math.hypot(
    drumRadius,
    drumAxialAdvancePerRadian,
  );
  const initialDrumWrapAngle = Math.PI;
  const movingPulleyPitchRadius = 0.72;
  const movingPulleyOuterRadius = 0.82;
  const movingPulleyHubRadius = 0.18;
  // Depth stack (front to back): link C; arm A; pulley E's front flange;
  // B's crank arm carrying the pin; then the drum, cord D and pulley E's
  // tread; then disk B. The crank pin's circle (radius 49 px on the plate)
  // crosses every line leaving the 27 px drum, so the pin cannot rise from
  // B's face through the cord's plane. It stands instead on a short crank
  // arm keyed to the shaft end just in front of the drum, so the pin only
  // occupies depths in front of the cord and D wraps the drum on B's front
  // face as Brown draws it.
  const cordPlaneZ = 0.44;
  const crankArmFrontZ = 0.61;
  const armAZ = 0.73;
  const linkCZ = 0.93;
  const cordRadius = 0.042;
  // The laid rope's lay shows the cord's travel, so it carries no markers.
  const cordMarkerCount = 0;
  const weightFixedX = -2.18;
  const initialWeightY = -2.65;
  const weightEyeOffsetY = 0.48;
  const weightWidth = 0.64;
  const weightHeight = 0.82;
  const demonstrationPeriod = 12;
  const angleDerivativeStep = 1e-5;

  const inputMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const armMaterial = matte(PALETTE.accent, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const linkageAtDiskAngle = (diskAngle) => {
    const crankPin = new THREE.Vector2(
      diskCenter.x + crankRadius * Math.cos(diskAngle),
      diskCenter.y + crankRadius * Math.sin(diskAngle),
    );
    const groundToCrank = crankPin.clone().sub(fixedPivotG);
    const centerDistance = groundToCrank.length();
    const alongDistance = (
      rockerJointRadius ** 2
        - couplerLength ** 2
        + centerDistance ** 2
    ) / (2 * centerDistance);
    const perpendicularDistance = Math.sqrt(Math.max(
      0,
      rockerJointRadius ** 2 - alongDistance ** 2,
    ));
    const along = groundToCrank.clone().divideScalar(centerDistance);
    const perpendicular = new THREE.Vector2(-along.y, along.x);
    const circleBase = fixedPivotG.clone().addScaledVector(
      along,
      alongDistance,
    );
    const first = circleBase.clone().addScaledVector(
      perpendicular,
      perpendicularDistance,
    );
    const second = circleBase.clone().addScaledVector(
      perpendicular,
      -perpendicularDistance,
    );
    const rockerJoint = first.x < second.x ? first : second;
    const rockerDirection = rockerJoint.clone()
      .sub(fixedPivotG)
      .normalize();
    const rockerAngle = Math.atan2(rockerDirection.y, rockerDirection.x);
    const pulleyCenter = fixedPivotG.clone().addScaledVector(
      rockerDirection,
      pulleyArmRadius,
    );
    return {
      centerDistance,
      crankPin,
      pulleyCenter,
      rockerAngle,
      rockerDirection,
      rockerJoint,
    };
  };

  const cordMetricsForWeight = (diskAngle, weightY) => {
    const linkage = linkageAtDiskAngle(diskAngle);
    const weightEye = new THREE.Vector2(
      weightFixedX,
      weightY + weightEyeOffsetY,
    );
    const weightTangent = tangentFromPointToCircle(
      weightEye,
      linkage.pulleyCenter,
      movingPulleyPitchRadius,
    );
    const tangentPair = internalTangentBetweenCircles(
      linkage.pulleyCenter,
      movingPulleyPitchRadius,
      diskCenter,
      drumRadius,
    );
    const weightTangentAngle = Math.atan2(
      weightTangent.y - linkage.pulleyCenter.y,
      weightTangent.x - linkage.pulleyCenter.x,
    );
    const outgoingTangentAngle = Math.atan2(
      tangentPair.pulleyTangent.y - linkage.pulleyCenter.y,
      tangentPair.pulleyTangent.x - linkage.pulleyCenter.x,
    );
    const movingPulleySweep = -positiveModulo(
      weightTangentAngle - outgoingTangentAngle,
      FULL_TURN,
    );
    const leftSpanLength = weightEye.distanceTo(weightTangent);
    const movingPulleyWrapLength = Math.abs(movingPulleySweep)
      * movingPulleyPitchRadius;
    const pulleyToDrumSpanLength = tangentPair.pulleyTangent.distanceTo(
      tangentPair.drumTangent,
    );
    const drumWrapAngle = initialDrumWrapAngle + diskAngle;
    const drumWrapLength = effectiveDrumTakeupRadius * drumWrapAngle;
    const incomingPulleyTangent = weightTangent.clone()
      .sub(weightEye)
      .normalize();
    const pulleyArcEntryTangent = new THREE.Vector2(
      weightTangent.y - linkage.pulleyCenter.y,
      -(weightTangent.x - linkage.pulleyCenter.x),
    ).normalize();
    const outgoingPulleyTangent = tangentPair.drumTangent.clone()
      .sub(tangentPair.pulleyTangent)
      .normalize();
    const pulleyArcExitTangent = new THREE.Vector2(
      tangentPair.pulleyTangent.y - linkage.pulleyCenter.y,
      -(tangentPair.pulleyTangent.x - linkage.pulleyCenter.x),
    ).normalize();
    const incomingDrumTangent = tangentPair.drumTangent.clone()
      .sub(tangentPair.pulleyTangent)
      .normalize();
    const positiveDrumTangent = new THREE.Vector2(
      -(tangentPair.drumTangent.y - diskCenter.y),
      tangentPair.drumTangent.x - diskCenter.x,
    ).normalize();
    const drumSweepSign = Math.sign(
      positiveDrumTangent.dot(incomingDrumTangent),
    ) || 1;
    return {
      drumEntryProjectedTangentError:
        1 - Math.abs(positiveDrumTangent.dot(incomingDrumTangent)),
      drumSweep: drumSweepSign * drumWrapAngle,
      drumTangent: tangentPair.drumTangent,
      drumWrapAngle,
      drumWrapLength,
      leftSpanLength,
      linkage,
      movingPulleySweep,
      movingPulleyWrapLength,
      outgoingTangentAngle,
      pulleyArcEntryTangentError:
        1 - incomingPulleyTangent.dot(pulleyArcEntryTangent),
      pulleyArcExitTangentError:
        1 - outgoingPulleyTangent.dot(pulleyArcExitTangent),
      pulleyTangent: tangentPair.pulleyTangent,
      pulleyToDrumSpanLength,
      totalLength:
        leftSpanLength
          + movingPulleyWrapLength
          + pulleyToDrumSpanLength
          + drumWrapLength,
      weightEye,
      weightTangent,
      weightTangentAngle,
      weightY,
    };
  };

  const initialCordMetrics = cordMetricsForWeight(0, initialWeightY);
  const constantCordLength = initialCordMetrics.totalLength;
  const solveWeightY = (diskAngle) => {
    let lower = -7;
    let upper = 3;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const midpoint = (lower + upper) / 2;
      const length = cordMetricsForWeight(diskAngle, midpoint).totalLength;
      if (length > constantCordLength) lower = midpoint;
      else upper = midpoint;
    }
    return (lower + upper) / 2;
  };

  const configurationAtDiskAngle = (diskAngle) => {
    const weightY = solveWeightY(diskAngle);
    const metrics = cordMetricsForWeight(diskAngle, weightY);
    const pulleyAngleUnwrapped = signedAngularDifference(
      metrics.weightTangentAngle,
      initialCordMetrics.weightTangentAngle,
    ) + (
      metrics.leftSpanLength - initialCordMetrics.leftSpanLength
    ) / movingPulleyPitchRadius;
    return {
      ...metrics,
      cordLengthError: metrics.totalLength - constantCordLength,
      pulleyAngle: wrappedAngle(pulleyAngleUnwrapped),
      pulleyAngleUnwrapped,
    };
  };

  const findExtremum = (mode) => {
    const sampleCount = 512;
    let bestIndex = 0;
    let bestValue = mode === 'maximum' ? -Infinity : Infinity;
    for (let index = 0; index <= sampleCount; index += 1) {
      const diskAngle = FULL_TURN * index / sampleCount;
      const value = configurationAtDiskAngle(diskAngle).weightY;
      if (
        (mode === 'maximum' && value > bestValue)
        || (mode === 'minimum' && value < bestValue)
      ) {
        bestIndex = index;
        bestValue = value;
      }
    }
    let left = FULL_TURN * Math.max(0, bestIndex - 1) / sampleCount;
    let right = FULL_TURN * Math.min(sampleCount, bestIndex + 1)
      / sampleCount;
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const first = (2 * left + right) / 3;
      const second = (left + 2 * right) / 3;
      const firstValue = configurationAtDiskAngle(first).weightY;
      const secondValue = configurationAtDiskAngle(second).weightY;
      const keepRight = mode === 'maximum'
        ? firstValue < secondValue
        : firstValue > secondValue;
      if (keepRight) left = first;
      else right = second;
    }
    const diskAngle = (left + right) / 2;
    return {
      diskAngle,
      weightY: configurationAtDiskAngle(diskAngle).weightY,
    };
  };

  const forwardMaximum = findExtremum('maximum');
  const forwardMinimum = findExtremum('minimum');
  const nextCycleMaximum = {
    diskAngle: forwardMaximum.diskAngle + FULL_TURN,
    weightY: configurationAtDiskAngle(
      forwardMaximum.diskAngle + FULL_TURN,
    ).weightY,
  };
  const downwardStrokeLength =
    forwardMaximum.weightY - forwardMinimum.weightY;
  const upwardStrokeLength =
    nextCycleMaximum.weightY - forwardMinimum.weightY;

  const makeCordCurve = (configuration) => {
    const curve = new THREE.CurvePath();
    const worldPoint = (point, z = cordPlaneZ) => new THREE.Vector3(
      point.x,
      point.y,
      z,
    );
    const weightEye = worldPoint(configuration.weightEye);
    const weightTangent = worldPoint(configuration.weightTangent);
    const pulleyCenter = worldPoint(configuration.linkage.pulleyCenter);
    const pulleyTangent = worldPoint(configuration.pulleyTangent);
    const drumTangent = worldPoint(configuration.drumTangent);
    curve.add(new THREE.LineCurve3(weightEye, weightTangent));
    curve.add(new CircularArcCurve3(
      pulleyCenter,
      weightTangent.clone().sub(pulleyCenter),
      Z_AXIS,
      configuration.movingPulleySweep,
    ));
    curve.add(new THREE.LineCurve3(pulleyTangent, drumTangent));
    curve.add(new DrumHelixCurve({
      axialAdvancePerRadian: drumAxialAdvancePerRadian,
      center: new THREE.Vector3(diskCenter.x, diskCenter.y, cordPlaneZ),
      radialStart: drumTangent.clone().sub(
        new THREE.Vector3(diskCenter.x, diskCenter.y, cordPlaneZ),
      ),
      sweep: configuration.drumSweep,
    }));
    curve.arcLengthDivisions = 480;
    return curve;
  };

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-right-standard-and-bearing-frame';
  root.add(frame);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.50, 0.18, 1.18),
    frameMaterial,
  );
  base.position.set(.625, -3.15, -.2);
  base.userData.role = 'fixed-base-rail';
  const rightPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 5.8, 0.8),
    frameMaterial,
  );
  rightPost.position.set(2.17, -0.22, -0.4);
  rightPost.userData.role = 'fixed-right-upright';
  const topBearingArm = makeDynamicLink({
    color: PALETTE.frame,
    depth: 0.34,
    jointRadius: 0.001,
    thickness: 0.18,
  });
  topBearingArm.userData.setEndpoints(
    new THREE.Vector3(fixedPivotG.x, fixedPivotG.y, -0.28),
    new THREE.Vector3(2.17, fixedPivotG.y, -0.28),
  );
  topBearingArm.userData.role = 'fixed-top-rocker-bearing-arm';
  // The arm stops at the rear face of B's drum instead of entering it.
  const diskBearingArm = makeDynamicLink({
    color: PALETTE.frame,
    depth: 0.29,
    jointRadius: 0.001,
    thickness: 0.18,
  });
  diskBearingArm.userData.setEndpoints(
    new THREE.Vector3(diskCenter.x, diskCenter.y, -0.62),
    new THREE.Vector3(2.17, diskCenter.y, -0.62),
  );
  diskBearingArm.userData.role = 'fixed-disk-bearing-arm';
  frame.add(base, rightPost, topBearingArm, diskBearingArm);

  const diskAssembly = new THREE.Group();
  diskAssembly.position.set(diskCenter.x, diskCenter.y, 0);
  diskAssembly.userData.axis = Z_AXIS.clone();
  diskAssembly.userData.role = 'revolving-disk-B-and-coaxial-cord-drum';
  root.add(diskAssembly);
  const diskBody = cylinderAlongZ(diskRadius, 0.3, inputMaterial, 80);
  diskBody.userData.role = 'revolving-disk-B';
  // B's shaft end runs forward through the drum and the crank arm; its end
  // is Brown's small axle circle.
  const diskHub = cylinderAlongZ(diskHubRadius, 0.56, darkMaterial, 44);
  diskHub.position.z = 0.13 + 0.28;
  diskHub.userData.role = 'fixed-axis-disk-B-hub';
  // The drum stands on B's front face; the cord winds back towards B.
  const drum = cylinderAlongZ(drumRadius - cordRadius, 0.34, inputMaterial, 56);
  drum.position.z = 0.15 + 0.17;
  drum.userData.effectiveTakeupRadius = effectiveDrumTakeupRadius;
  drum.userData.role = 'cord-winding-drum-coaxial-with-disk-B';
  const diskIndex = new THREE.Mesh(
    new THREE.BoxGeometry(diskRadius * 0.72, 0.075, 0.035),
    whiteMaterial,
  );
  diskIndex.position.set(diskRadius * 0.44, 0, 0.19);
  diskIndex.userData.role = 'white-disk-B-and-drum-speed-index';
  // Overhung crank arm on the shaft end, in front of the drum and cord.
  const crankArmHalfWidth = 0.13;
  const crankArmShape = new THREE.Shape();
  crankArmShape.moveTo(0, -crankArmHalfWidth);
  crankArmShape.lineTo(crankRadius, -crankArmHalfWidth);
  crankArmShape.absarc(crankRadius, 0, crankArmHalfWidth, -Math.PI / 2, Math.PI / 2, false);
  crankArmShape.lineTo(0, crankArmHalfWidth);
  crankArmShape.absarc(0, 0, crankArmHalfWidth, Math.PI / 2, Math.PI * 1.5, false);
  const crankArm = new THREE.Mesh(
    new THREE.ExtrudeGeometry(crankArmShape, {
      bevelEnabled: false,
      curveSegments: 24,
      depth: 0.1,
    }).translate(0, 0, crankArmFrontZ - 0.1),
    inputMaterial,
  );
  crankArm.userData.role = 'disk-B-shaft-crank-arm-in-front-of-drum';
  diskAssembly.add(diskBody, diskHub, drum, crankArm, diskIndex);
  const armA = foldingRod({length: pulleyArmRadius, width: .16, depth: .18,
    bore: .184, material: armMaterial, role: 'rocking-arm-A-pivoted-at-G-and-carrying-pulley-E'});
  armA.userData.addPinEye(rockerJointRadius, .119);
  armA.userData.role = 'rocking-arm-A-pivoted-at-G-and-carrying-pulley-E';
  root.add(armA);
  const linkC = foldingRod({length: couplerLength, width: .14, depth: .16,
    bore: .124, material: armMaterial, role: 'connecting-arm-C-from-disk-crank-to-arm-A'});
  linkC.userData.role = 'connecting-arm-C-from-disk-crank-to-arm-A';
  root.add(linkC);

  const movingPulley = new THREE.Group();
  movingPulley.userData.axis = Z_AXIS.clone();
  movingPulley.userData.role = 'arm-A-carried-moving-pulley-E';
  const movingPulleyRotor = new THREE.Group();
  movingPulleyRotor.userData.role = 'no-slip-moving-pulley-E-rotor';
  const pulleyCore = cylinderAlongZ(
    movingPulleyPitchRadius - cordRadius,
    0.25,
    drivenMaterial,
    68,
  );
  pulleyCore.position.z = cordPlaneZ;
  pulleyCore.userData.role = 'moving-pulley-E-cord-tread';
  const pulleyFlanges = [-1, 1].map((side) => {
    const flange = cylinderAlongZ(
      movingPulleyOuterRadius,
      0.055,
      drivenMaterial,
      72,
    );
    flange.position.z = cordPlaneZ + side * 0.145;
    flange.userData.role =
      `${side < 0 ? 'rear' : 'front'}-moving-pulley-E-flange`;
    movingPulleyRotor.add(flange);
    return flange;
  });
  const pulleyHub = cylinderAlongZ(
    movingPulleyHubRadius,
    0.59,
    darkMaterial,
    40,
  );
  pulleyHub.position.z = 0.545;
  pulleyHub.userData.role = 'moving-pulley-E-arm-journal';
  const pulleyIndex = new THREE.Mesh(
    new THREE.BoxGeometry(movingPulleyPitchRadius * 0.72, 0.065, 0.028),
    whiteMaterial,
  );
  pulleyIndex.position.set(
    movingPulleyPitchRadius * 0.45,
    0,
    cordPlaneZ + 0.185,
  );
  pulleyIndex.userData.role = 'white-no-slip-pulley-E-speed-index';
  movingPulleyRotor.add(pulleyCore, pulleyHub, pulleyIndex);
  movingPulley.add(movingPulleyRotor);
  root.add(movingPulley);

  const weight = new THREE.Group();
  weight.position.x = weightFixedX;
  weight.userData.role = 'strictly-vertical-reciprocating-weight-W';
  const weightBody = new THREE.Mesh(
    new THREE.BoxGeometry(weightWidth, weightHeight, 0.46),
    drivenMaterial,
  );
  weightBody.userData.role = 'hanging-weight-W-body';
  weightBody.position.z = cordPlaneZ;
  const weightEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.035, 10, 36),
    darkMaterial,
  );
  weightEye.position.set(0, weightEyeOffsetY, cordPlaneZ);
  weightEye.userData.role = 'weight-W-cord-eye';
  weight.add(weightBody, weightEye);
  root.add(weight);

  const initialConfiguration = configurationAtDiskAngle(0);
  const initialCordCurve = makeCordCurve(initialConfiguration);
  // Cord D is a laid rope; its lay is fixed in the material from the
  // weight end, so no flow markers are needed.
  const cord = makeDynamicMovingBelt(initialCordCurve, {
    closed: false,
    color: PALETTE.belt,
    laid: true,
    markerCount: 0,
    radius: cordRadius,
    tubularSegments: 288,
  });
  cord.userData.inextensible = true;
  cord.userData.materialPath = true;
  cord.userData.ropeCount = 1;
  cord.userData.role =
    'one-continuous-weight-to-moving-pulley-to-drum-cord-D';
  const cordMesh = cord.userData.mesh;
  cordMesh.userData.role = 'single-visible-continuous-cord-D-tube';
  const cordMarkers = cord.children.filter((object) => (
    object.userData.isFlowMarker === true
  ));
  cordMarkers.forEach((marker, index) => {
    marker.userData.materialDistance = constantCordLength
      * (index + 1) / (cordMarkerCount + 1);
    marker.userData.role = `fixed-material-cord-D-marker-${index + 1}`;
  });
  root.add(cord);

  const fixedPivot = cylinderAlongZ(0.18, 1.14, darkMaterial, 40);
  fixedPivot.position.set(fixedPivotG.x, fixedPivotG.y, 0.27);
  fixedPivot.userData.role = 'fixed-rocker-pivot-G';
  root.add(fixedPivot);
  // Seated on the crank arm's front face, never at the cord's depth.
  const crankPin = cylinderAlongZ(0.11, 0.39, darkMaterial, 34);
  crankPin.userData.role = 'eccentric-pin-on-disk-B-driving-link-C';
  root.add(crankPin);
  const rockerJointPin = cylinderAlongZ(0.115, 0.40, darkMaterial, 34);
  rockerJointPin.userData.role = 'joint-between-link-C-and-arm-A';
  root.add(rockerJointPin);

  const cordContactMarkers = Array.from({ length: 3 }, (_, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 20, 14),
      whiteMaterial,
    );
    marker.userData.role = [
      'weight-side-tangent-on-moving-pulley-E',
      'drum-side-tangent-on-moving-pulley-E',
      'cord-D-tangent-on-drum-B',
    ][index];
    root.add(marker);
    return marker;
  });

  const stateAtTime = (time) => {
    const wrappedTime = positiveModulo(time, demonstrationPeriod);
    const phase = FULL_TURN * wrappedTime / demonstrationPeriod;
    const phaseRate = FULL_TURN / demonstrationPeriod;
    const diskAngleUnwrapped = Math.PI * (1 - Math.cos(phase));
    const diskAngularSpeed = Math.PI * phaseRate * Math.sin(phase);
    const diskAngularAcceleration = Math.PI
      * phaseRate ** 2 * Math.cos(phase);
    const configuration = configurationAtDiskAngle(diskAngleUnwrapped);
    const before = configurationAtDiskAngle(
      diskAngleUnwrapped - angleDerivativeStep,
    );
    const after = configurationAtDiskAngle(
      diskAngleUnwrapped + angleDerivativeStep,
    );
    const weightDerivativePerDiskRadian = (
      after.weightY - before.weightY
    ) / (2 * angleDerivativeStep);
    const pulleyAngleDerivativePerDiskRadian = (
      after.pulleyAngleUnwrapped - before.pulleyAngleUnwrapped
    ) / (2 * angleDerivativeStep);
    const rockerDerivativePerDiskRadian = signedAngularDifference(
      after.linkage.rockerAngle,
      before.linkage.rockerAngle,
    ) / (2 * angleDerivativeStep);
    const pulleyCenterVelocityPerDiskRadian = after.linkage.pulleyCenter
      .clone()
      .sub(before.linkage.pulleyCenter)
      .multiplyScalar(1 / (2 * angleDerivativeStep));
    return {
      configuration,
      cordLength: configuration.totalLength,
      cordLengthError: configuration.cordLengthError,
      diskAngle: wrappedAngle(diskAngleUnwrapped),
      diskAngleUnwrapped,
      diskAngularAcceleration,
      diskAngularSpeed,
      drumTakeupLength:
        effectiveDrumTakeupRadius * diskAngleUnwrapped,
      drumTakeupRate: effectiveDrumTakeupRadius * diskAngularSpeed,
      phase,
      pulleyAngle: configuration.pulleyAngle,
      pulleyAngleUnwrapped: configuration.pulleyAngleUnwrapped,
      pulleyAngularSpeed:
        pulleyAngleDerivativePerDiskRadian * diskAngularSpeed,
      pulleyCenter: configuration.linkage.pulleyCenter.clone(),
      pulleyCenterVelocity: pulleyCenterVelocityPerDiskRadian.multiplyScalar(
        diskAngularSpeed,
      ),
      rockerAngle: configuration.linkage.rockerAngle,
      rockerAngularSpeed: rockerDerivativePerDiskRadian * diskAngularSpeed,
      weightPosition: new THREE.Vector3(
        weightFixedX,
        configuration.weightY,
        0,
      ),
      weightVelocityY:
        weightDerivativePerDiskRadian * diskAngularSpeed,
      wrappedTime,
    };
  };

  root.userData.archetype =
    'crank-rocker-carried-moving-pulley-plus-coaxial-drum-takeup-driving-unequal-weight-strokes';
  root.userData.blocks = {
    armA,
    base,
    cord,
    cordContactMarkers,
    cordMarkers,
    diskAssembly,
    crankArm,
    diskBody,
    diskHub,
    diskIndex,
    drum,
    fixedPivot,
    frame,
    linkC,
    movingPulley,
    movingPulleyRotor,
    pulleyCore,
    pulleyFlanges,
    pulleyHub,
    pulleyIndex,
    rockerJointPin,
    weight,
    weightBody,
    weightEye,
    crankPin,
  };
  root.userData.cameraDistanceScale = 1;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.65, -3.85, -0.85),
    new THREE.Vector3(2.45, 4.2, 1.05),
  );
  root.userData.cordDefinition = {
    constantCenterlineLength: constantCordLength,
    exactRoute:
      'weight-eye-to-left-moving-pulley-tangent-clockwise-wrap-to-internal-drum-tangent-then-helical-drum-wrap',
    fixedMaterialMarkers: true,
    renderedCordCount: 1,
  };
  root.userData.driveSchedule = {
    diskExcursion:
      'one-smooth-forward-revolution-followed-by-one-smooth-reverse-revolution',
    sourcePrescribesReversal: false,
    purpose:
      'show-one-finite-winding-cycle-and-return-without-resetting-the-cord-or-weight',
  };
  root.userData.geometry = {
    cordMarkerCount,
    cordPlaneZ,
    cordRadius,
    couplerLength,
    crankRadius,
    diskCenter: diskCenter.clone(),
    diskHubRadius,
    diskRadius,
    drumAxialAdvancePerRadian,
    drumRadius,
    effectiveDrumTakeupRadius,
    fixedPivotG: fixedPivotG.clone(),
    initialDrumWrapAngle,
    initialWeightY,
    movingPulleyHubRadius,
    movingPulleyOuterRadius,
    movingPulleyPitchRadius,
    pulleyArmRadius,
    rockerJointRadius,
    weightEyeOffsetY,
    weightFixedX,
    weightHeight,
    weightWidth,
  };
  root.userData.mechanism =
    'disk-B-crank-and-link-C-rock-arm-A-about-G-arm-A-carries-pulley-E-while-the-coaxial-drum-winds-the-single-cord-D-and-shortens-the-downstroke-of-weight-W';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate261: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one crank-rocker carries one moving pulley while one cord runs from weight W over that pulley to a coaxial winding drum on disk B',
      measurementUncertaintyPixels: 6,
      officialAnimationAvailable: false,
      rasterAnchors: {
        crankPin: { x: 274, y: 386 },
        diskCenterB: { x: 225, y: 388 },
        fixedPivotG: { x: 352, y: 85 },
        movingPulleyE: { x: 129, y: 99 },
        rockerJoint: { x: 207, y: 97 },
      },
      rasterMovingPulleyRadius: 56,
      rasterWeightBounds: {
        bottom: 517,
        left: 50,
        right: 96,
        top: 431,
      },
      view:
        'front-elevation-of-the-planar-linkage-cord-drum-and-hanging-weight',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 67,
      edition: 21,
      illustrationPage: 66,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.strokeAnalysis = {
    downwardStrokeLength,
    forwardMaximum,
    forwardMinimum,
    nextCycleMaximum,
    sourceRequiredInequality: 'downward-stroke-shorter-than-upward-stroke',
    upwardStrokeLength,
  };
  root.userData.timeline = {
    cycleClosure: demonstrationPeriod,
    demonstrationPeriod,
    forwardWindingEnd: demonstrationPeriod / 2,
    reverseUnwindingEnd: demonstrationPeriod,
  };
  root.userData.transmission = {
    configurationAtDiskAngle,
    constantCordLength,
    drumTakeupLengthPerRevolution:
      effectiveDrumTakeupRadius * FULL_TURN,
    idealFixedEndParallelSpanLaw:
      'weight-displacement=two-times-moving-pulley-displacement',
    movingPulleyNoSlipLaw:
      'pulley-angle-change=tangent-angle-change+left-span-length-change/pitch-radius',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const { configuration } = state;
    diskAssembly.rotation.z = state.diskAngle;
    armA.userData.setEndpoints(
      new THREE.Vector3(fixedPivotG.x, fixedPivotG.y, armAZ),
      new THREE.Vector3(
        configuration.linkage.pulleyCenter.x,
        configuration.linkage.pulleyCenter.y,
        armAZ,
      ),
    );
    linkC.userData.setEndpoints(
      new THREE.Vector3(
        configuration.linkage.rockerJoint.x,
        configuration.linkage.rockerJoint.y,
        linkCZ,
      ),
      new THREE.Vector3(
        configuration.linkage.crankPin.x,
        configuration.linkage.crankPin.y,
        linkCZ,
      ),
    );
    movingPulley.position.set(
      configuration.linkage.pulleyCenter.x,
      configuration.linkage.pulleyCenter.y,
      0,
    );
    movingPulleyRotor.rotation.z = state.pulleyAngle;
    weight.position.y = configuration.weightY;
    crankPin.position.set(
      configuration.linkage.crankPin.x,
      configuration.linkage.crankPin.y,
      crankArmFrontZ + 0.195,
    );
    rockerJointPin.position.set(
      configuration.linkage.rockerJoint.x,
      configuration.linkage.rockerJoint.y,
      0.82,
    );
    cordContactMarkers[0].position.set(
      configuration.weightTangent.x,
      configuration.weightTangent.y,
      cordPlaneZ,
    );
    cordContactMarkers[1].position.set(
      configuration.pulleyTangent.x,
      configuration.pulleyTangent.y,
      cordPlaneZ,
    );
    cordContactMarkers[2].position.set(
      configuration.drumTangent.x,
      configuration.drumTangent.y,
      cordPlaneZ,
    );
    const cordCurve = makeCordCurve(configuration);
    cord.userData.setCurve(cordCurve);
    cord.userData.centerlineLength = configuration.totalLength;
    cord.userData.centerlineLengthError = configuration.cordLengthError;
    root.userData.kinematics = state;
  };
  // Plate 261 hangs everything from a wall: no floor slab, and neither the
  // disk, pulley nor cord carries white index marks.
  base.removeFromParent();
  diskIndex.visible = false;
  pulleyIndex.visible = false;
  for (const marker of [...cordMarkers, ...cordContactMarkers]) {
    marker.visible = false;
  }
  // Brown braces the disk-B arm to the wall with a concave cast gusset.
  const braceSize = 0.9;
  const wallX = 2.17 - 0.11;
  const armUnderside = diskCenter.y - 0.09;
  const braceShape = new THREE.Shape();
  braceShape.moveTo(wallX - braceSize, armUnderside);
  braceShape.lineTo(wallX, armUnderside);
  braceShape.lineTo(wallX, armUnderside - braceSize);
  braceShape.absarc(
    wallX - braceSize,
    armUnderside - braceSize,
    braceSize,
    0,
    Math.PI / 2,
    false,
  );
  const diskArmBrace = new THREE.Mesh(
    new THREE.ExtrudeGeometry(braceShape, {
      bevelEnabled: false,
      curveSegments: 32,
      depth: 0.2,
    }).translate(0, 0, -0.72),
    frameMaterial,
  );
  diskArmBrace.userData.role = 'source-concave-gusset-under-disk-bearing-arm';
  frame.add(diskArmBrace);
  root.userData.blocks.diskArmBrace = diskArmBrace;
  fitPistonGuide(root, update, demonstrationPeriod);
  markShadows(root);
  return {
    root,
    update,
    // Plate 261 is a flat front elevation.
    cameraDirection: new THREE.Vector3(0, 0.03, 1),
  };
}

export function createAuthoredCombinationDriveMovement(movement) {
  if (movement.id !== 261) return null;
  const result = combinationWeightDrive(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
