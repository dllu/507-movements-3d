import * as THREE from 'three';
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

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.006) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 24,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index].x, points[index].y);
  }
  shape.closePath();
  return shape;
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

function beamBetween(start, end, width, depth, material, z) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.set(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    z,
  );
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function circleCircleIntersections(centerA, radiusA, centerB, radiusB) {
  const centerDelta = centerB.clone().sub(centerA);
  const distance = centerDelta.length();
  if (distance === 0) throw new Error('Coincident linkage-circle centers');
  const along = (
    radiusA ** 2 - radiusB ** 2 + distance ** 2
  ) / (2 * distance);
  const heightSquared = radiusA ** 2 - along ** 2;
  if (heightSquared < -1e-12) throw new Error('Disjoint linkage circles');
  const height = Math.sqrt(Math.max(0, heightSquared));
  const direction = centerDelta.multiplyScalar(1 / distance);
  const foot = centerA.clone().addScaledVector(direction, along);
  const perpendicular = new THREE.Vector2(-direction.y, direction.x);
  return [
    foot.clone().addScaledVector(perpendicular, height),
    foot.clone().addScaledVector(perpendicular, -height),
  ];
}

function nearestPoint(points, reference) {
  return points[0].distanceToSquared(reference)
    <= points[1].distanceToSquared(reference) ? points[0] : points[1];
}

function constrainedPointRates({
  accelerationA,
  accelerationB,
  centerA,
  centerB,
  point,
  velocityA,
  velocityB,
}) {
  const radialA = point.clone().sub(centerA);
  const radialB = point.clone().sub(centerB);
  const determinant = cross2(radialA, radialB);
  if (Math.abs(determinant) < 1e-12) {
    throw new Error('Singular two-circle linkage state');
  }
  const velocityRhsA = radialA.dot(velocityA);
  const velocityRhsB = radialB.dot(velocityB);
  const velocity = new THREE.Vector2(
    (velocityRhsA * radialB.y - radialA.y * velocityRhsB)
      / determinant,
    (radialA.x * velocityRhsB - velocityRhsA * radialB.x)
      / determinant,
  );
  const relativeVelocityA = velocity.clone().sub(velocityA);
  const relativeVelocityB = velocity.clone().sub(velocityB);
  const accelerationRhsA = radialA.dot(accelerationA)
    - relativeVelocityA.lengthSq();
  const accelerationRhsB = radialB.dot(accelerationB)
    - relativeVelocityB.lengthSq();
  const acceleration = new THREE.Vector2(
    (accelerationRhsA * radialB.y - radialA.y * accelerationRhsB)
      / determinant,
    (radialA.x * accelerationRhsB
      - accelerationRhsA * radialB.x) / determinant,
  );
  return { acceleration, determinant, velocity };
}

function rigidLinkRates(vector, velocity, acceleration) {
  const lengthSquared = vector.lengthSq();
  const crossVelocity = cross2(vector, velocity);
  return {
    angle: Math.atan2(vector.y, vector.x),
    angularAcceleration: (
      cross2(vector, acceleration) * lengthSquared
        - 2 * vector.dot(velocity) * crossVelocity
    ) / lengthSquared ** 2,
    angularVelocity: crossVelocity / lengthSquared,
  };
}

function makePinnedRod({
  bodyMaterial,
  depth,
  eyeMaterial,
  length,
  planeZ,
  role,
  width,
}) {
  const rod = new THREE.Group();
  rod.userData.nominalLength = length;
  rod.userData.role = role;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(length, width, depth),
    bodyMaterial,
  );
  body.position.set(length / 2, 0, planeZ);
  body.userData.role = `${role}-constant-length-shank`;
  const startBoss = cylinderAlongZ(width * 0.78, depth * 1.16,
    bodyMaterial, 34);
  startBoss.position.z = planeZ;
  startBoss.userData.role = `${role}-start-boss`;
  const endBoss = cylinderAlongZ(width * 0.78, depth * 1.16,
    bodyMaterial, 34);
  endBoss.position.set(length, 0, planeZ);
  endBoss.userData.role = `${role}-end-boss`;
  const startEye = new THREE.Mesh(
    new THREE.TorusGeometry(width * 0.43, width * 0.12, 8, 30),
    eyeMaterial,
  );
  startEye.position.z = planeZ + depth / 2 + 0.012;
  startEye.userData.role = `${role}-start-eye`;
  const endEye = new THREE.Mesh(
    new THREE.TorusGeometry(width * 0.43, width * 0.12, 8, 30),
    eyeMaterial,
  );
  endEye.position.set(length, 0, planeZ + depth / 2 + 0.012);
  endEye.userData.role = `${role}-end-eye`;
  const startAnchor = new THREE.Object3D();
  startAnchor.position.z = planeZ;
  startAnchor.userData.role = `${role}-analytic-start`;
  const endAnchor = new THREE.Object3D();
  endAnchor.position.set(length, 0, planeZ);
  endAnchor.userData.role = `${role}-analytic-end`;
  rod.add(
    body,
    startBoss,
    endBoss,
    startEye,
    endEye,
    startAnchor,
    endAnchor,
  );
  return {
    body,
    endAnchor,
    endBoss,
    endEye,
    rod,
    startAnchor,
    startBoss,
    startEye,
  };
}

function makeSectorToothGeometry({
  depth,
  outerRadius,
  rootRadius,
  sourceScale,
}) {
  const sourceTipHalfWidth = 0.137081;
  const sourceRootHalfWidth = 0.405;
  const tipHalfAngle = sourceTipHalfWidth / (outerRadius / sourceScale);
  const rootHalfAngle = sourceRootHalfWidth / (rootRadius / sourceScale);
  const shape = new THREE.Shape();
  shape.moveTo(
    rootRadius * Math.cos(-rootHalfAngle),
    rootRadius * Math.sin(-rootHalfAngle),
  );
  shape.lineTo(
    outerRadius * Math.cos(-tipHalfAngle),
    outerRadius * Math.sin(-tipHalfAngle),
  );
  shape.lineTo(
    outerRadius * Math.cos(tipHalfAngle),
    outerRadius * Math.sin(tipHalfAngle),
  );
  shape.lineTo(
    rootRadius * Math.cos(rootHalfAngle),
    rootRadius * Math.sin(rootHalfAngle),
  );
  shape.closePath();
  return centeredExtrusion(shape, depth, 0.0025);
}

function makeBeamAndSectors({
  beamMaterial,
  darkMaterial,
  geometry,
  whiteMaterial,
}) {
  const {
    beamPlaneZ,
    chainAttachment,
    chainGuideRadius,
    sectorAngularPitch,
    sectorOuterRadius,
    sectorRootRadius,
    sourceScale,
  } = geometry;
  const beam = new THREE.Group();
  beam.userData.axis = Z_AXIS.clone();
  beam.userData.role =
    'one-rigid-rocking-beam-D-with-toothed-sector-C-and-chain-shoe';

  const bodyPoints = [
    new THREE.Vector2(-15.984680, 0.700000),
    new THREE.Vector2(11.000000, 0.700000),
    new THREE.Vector2(11.000000, 4.700000),
    new THREE.Vector2(-13.187494, 4.700000),
  ].map((point) => point.multiplyScalar(sourceScale));
  const body = new THREE.Mesh(
    centeredExtrusion(polygonShape(bodyPoints), 0.25, 0.008),
    beamMaterial,
  );
  body.position.z = beamPlaneZ;
  body.userData.role = 'rigid-source-profile-beam-D';
  beam.add(body);

  const sectorWebStart = Math.PI - 16.5 * Math.PI / 180;
  const sectorWebEnd = Math.PI + 16.5 * Math.PI / 180;
  const sectorWeb = new THREE.Mesh(
    centeredExtrusion(annularSectorShape(
      sectorRootRadius - 1.2 * sourceScale,
      sectorRootRadius - 0.025,
      sectorWebStart,
      sectorWebEnd,
    ), 0.25, 0.005),
    beamMaterial,
  );
  sectorWeb.position.z = beamPlaneZ;
  sectorWeb.userData.role = 'narrow-toothed-rim-of-open-sector-C';
  beam.add(sectorWeb);

  const sectorToothGeometry = makeSectorToothGeometry({
    depth: 0.25,
    outerRadius: sectorOuterRadius,
    rootRadius: sectorRootRadius,
    sourceScale,
  });
  const sectorTeeth = Array.from({ length: 17 }, (_, index) => {
    const tooth = new THREE.Mesh(sectorToothGeometry.clone(), beamMaterial);
    const centeredIndex = index - 8;
    tooth.rotation.z = Math.PI + centeredIndex * sectorAngularPitch;
    tooth.position.z = beamPlaneZ;
    tooth.userData.centerAngle = tooth.rotation.z;
    tooth.userData.index = index;
    tooth.userData.role = 'working-tooth-of-thirty-unit-sector-C';
    beam.add(tooth);
    return tooth;
  });

  const spokeEnds = [
    new THREE.Vector2(-27.50, -7.483315),
    new THREE.Vector2(-27.50, -6.177907),
    new THREE.Vector2(-26.50, 4.70),
  ].map((point) => point.multiplyScalar(sourceScale));
  const spokeStarts = [
    new THREE.Vector2(-17.827491, 0.632884),
    new THREE.Vector2(-19.303229, 0.700000),
    new THREE.Vector2(-13.187494, 4.700000),
  ].map((point) => point.multiplyScalar(sourceScale));
  const sectorSpokes = spokeEnds.map((end, index) => {
    const spoke = beamBetween(
      spokeStarts[index],
      end,
      0.13,
      0.18,
      beamMaterial,
      beamPlaneZ + 0.01,
    );
    spoke.userData.role = 'rigid-open-sector-C-web-brace';
    beam.add(spoke);
    return spoke;
  });

  const shoeStart = 2.740167;
  const shoeEnd = 3.490659;
  const chainShoe = new THREE.Mesh(
    centeredExtrusion(annularSectorShape(
      14 * sourceScale,
      16 * sourceScale,
      shoeStart,
      shoeEnd,
    ), 0.20, 0.005),
    beamMaterial,
  );
  chainShoe.position.z = 0.42;
  chainShoe.userData.guideRadius = chainGuideRadius;
  chainShoe.userData.role =
    'curved-chain-suspension-shoe-concentric-with-pivot-F';
  beam.add(chainShoe);

  const pivotBoss = cylinderAlongZ(0.70 * sourceScale, 0.34,
    beamMaterial, 42);
  pivotBoss.position.z = beamPlaneZ;
  pivotBoss.userData.role = 'beam-D-working-pivot-boss-at-F';
  const pivotBore = cylinderAlongZ(0.31 * sourceScale, 0.37,
    darkMaterial, 34);
  pivotBore.position.z = beamPlaneZ + 0.004;
  pivotBore.userData.role = 'beam-D-pivot-bore-at-F';
  const rotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(1.8 * sourceScale, 0.055, 0.035),
    whiteMaterial,
  );
  rotationIndex.position.set(-0.9 * sourceScale, 0, beamPlaneZ + 0.20);
  rotationIndex.userData.role = 'visible-index-on-rocking-beam-D';

  const chainAttachmentBoss = cylinderAlongZ(0.34 * sourceScale, 0.25,
    beamMaterial, 34);
  chainAttachmentBoss.position.set(
    chainAttachment.x,
    chainAttachment.y,
    0.42,
  );
  chainAttachmentBoss.userData.role = 'chain-attachment-boss-on-beam-D';
  const chainAttachmentAnchor = new THREE.Object3D();
  chainAttachmentAnchor.position.set(
    chainAttachment.x,
    chainAttachment.y,
    0.58,
  );
  chainAttachmentAnchor.userData.role =
    'analytic-chain-attachment-on-beam-D';
  beam.add(
    pivotBoss,
    pivotBore,
    rotationIndex,
    chainAttachmentBoss,
    chainAttachmentAnchor,
  );

  return {
    beam,
    body,
    chainAttachmentAnchor,
    chainAttachmentBoss,
    chainShoe,
    pivotBore,
    pivotBoss,
    rotationIndex,
    sectorSpokes,
    sectorTeeth,
    sectorWeb,
  };
}

function makeRack({
  darkMaterial,
  geometry,
  rackMaterial,
  whiteMaterial,
}) {
  const {
    rackOriginX,
    rackPlaneZ,
    rackFirstToothCenterY,
    rackToothPitch,
    sourceScale,
  } = geometry;
  const rack = new THREE.Group();
  rack.position.x = rackOriginX;
  rack.userData.axis = new THREE.Vector3(0, 1, 0);
  rack.userData.role = 'straight-toothed-piston-rod-rack-B';

  const bodyLeft = -0.833333 * sourceScale;
  const bodyRight = 0.166667 * sourceScale;
  const bodyTop = 9.059854 * sourceScale;
  const toothedBottom = -10.242505 * sourceScale;
  const visibleRodBottom = -27.0 * sourceScale;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      bodyRight - bodyLeft,
      bodyTop - visibleRodBottom,
      0.24,
    ),
    rackMaterial,
  );
  body.position.set(
    (bodyLeft + bodyRight) / 2,
    (bodyTop + visibleRodBottom) / 2,
    rackPlaneZ,
  );
  body.userData.role = 'piston-rod-and-solid-back-of-rack-B';
  rack.add(body);

  const toothRootX = 0;
  const toothTipX = 0.666667 * sourceScale;
  const rootHalfWidth = 0.401321 * sourceScale;
  const tipHalfWidth = 0.158675 * sourceScale;
  const toothShape = new THREE.Shape();
  toothShape.moveTo(toothRootX, -rootHalfWidth);
  toothShape.lineTo(toothTipX, -tipHalfWidth);
  toothShape.lineTo(toothTipX, tipHalfWidth);
  toothShape.lineTo(toothRootX, rootHalfWidth);
  toothShape.closePath();
  const toothGeometry = centeredExtrusion(toothShape, 0.24, 0.0025);
  const rackTeeth = Array.from({ length: 17 }, (_, index) => {
    const tooth = new THREE.Mesh(toothGeometry.clone(), rackMaterial);
    tooth.position.set(
      0,
      rackFirstToothCenterY + index * rackToothPitch,
      rackPlaneZ,
    );
    tooth.userData.index = index;
    tooth.userData.role = 'working-tooth-of-straight-piston-rack-B';
    rack.add(tooth);
    return tooth;
  });

  const topCap = cylinderAlongZ(0.50 * sourceScale, 0.25,
    rackMaterial, 30);
  topCap.position.set(toothTipX, toothedBottom, rackPlaneZ);
  topCap.userData.role = 'rounded-upper-end-of-rack-B';
  const lowerRodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 2.2 * sourceScale, 0.03),
    whiteMaterial,
  );
  lowerRodIndex.position.set(
    (bodyLeft + bodyRight) / 2,
    visibleRodBottom + 1.5 * sourceScale,
    rackPlaneZ + 0.145,
  );
  lowerRodIndex.userData.role = 'visible-index-on-translating-rack-B';
  const backWearStrip = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.045,
      bodyTop - toothedBottom,
      0.255,
    ),
    darkMaterial,
  );
  backWearStrip.position.set(
    bodyLeft - 0.022,
    (bodyTop + toothedBottom) / 2,
    rackPlaneZ,
  );
  backWearStrip.userData.role = 'roller-A-contact-wear-strip-on-rack-back';

  const originAnchor = new THREE.Object3D();
  originAnchor.position.set(0, 0, rackPlaneZ);
  originAnchor.userData.role = 'official-rack-B-transform-origin';
  const backLineAnchor = new THREE.Object3D();
  backLineAnchor.position.set(bodyLeft, 0, rackPlaneZ);
  backLineAnchor.userData.role = 'analytic-back-line-of-rack-B';
  rack.add(
    topCap,
    lowerRodIndex,
    backWearStrip,
    originAnchor,
    backLineAnchor,
  );
  return {
    backLineAnchor,
    backWearStrip,
    body,
    lowerRodIndex,
    originAnchor,
    rack,
    rackTeeth,
    topCap,
  };
}

function makeFlexibleChainLink({
  chainMaterial,
  darkMaterial,
  depth,
  nominalPitch,
  width,
}) {
  const link = new THREE.Group();
  link.userData.flexibleChainElement = true;
  link.userData.nominalArcPitch = nominalPitch;
  link.userData.role = 'articulated-link-of-D-suspension-chain';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(nominalPitch, width * 0.54, depth),
    chainMaterial,
  );
  body.position.x = nominalPitch / 2;
  body.userData.role = 'chain-side-plate-between-adjacent-pins';
  const startBoss = cylinderAlongZ(width * 0.47, depth * 1.10,
    chainMaterial, 26);
  const endBoss = cylinderAlongZ(width * 0.47, depth * 1.10,
    chainMaterial, 26);
  endBoss.position.x = nominalPitch;
  const startPin = cylinderAlongZ(width * 0.16, depth * 1.18,
    darkMaterial, 22);
  const endPin = cylinderAlongZ(width * 0.16, depth * 1.18,
    darkMaterial, 22);
  endPin.position.x = nominalPitch;
  for (const part of [body, startBoss, endBoss, startPin, endPin]) {
    part.position.z = 0.58;
  }
  startBoss.userData.role = 'chain-link-start-eye';
  endBoss.userData.role = 'chain-link-end-eye';
  startPin.userData.role = 'chain-link-start-pin';
  endPin.userData.role = 'chain-link-end-pin';
  const startAnchor = new THREE.Object3D();
  startAnchor.position.z = 0.58;
  startAnchor.userData.role = 'analytic-chain-link-start';
  const endAnchor = new THREE.Object3D();
  endAnchor.position.set(nominalPitch, 0, 0.58);
  endAnchor.userData.role = 'analytic-chain-link-end';
  link.add(
    body,
    startBoss,
    endBoss,
    startPin,
    endPin,
    startAnchor,
    endAnchor,
  );
  return {
    body,
    endAnchor,
    endBoss,
    endPin,
    link,
    startAnchor,
    startBoss,
    startPin,
  };
}

function singleActingBeamRackParallelMotion(movement) {
  const root = new THREE.Group();

  // Brown's plate contains two exact pitch-line transmissions on the same
  // rocking beam. The red piston rod B is a straight rack backed by roller A
  // and meshes with the 30-unit sector C. The green articulated suspension at
  // D unwraps from a 16.5-unit circular shoe into a second vertical rod. The
  // official animation rounds its endpoints to six decimals; the mechanism
  // below uses the intended 15-degree geometry and exposes the raw constants.
  const sourceScale = 0.145;
  const sourceBeamPivotF = new THREE.Vector2(0, 0);
  const sourceBeamHalfSwing = Math.PI / 12;
  const sourceSectorPitchRadius = 30;
  const sourceSectorRootRadius = 29.666667;
  const sourceSectorOuterRadius = 30.333333;
  const sourceSectorEquivalentTeeth = 180;
  const sourceSectorToothCount = 17;
  const sourceRackToothCount = 17;
  const sourceRackOriginX = -30.383024;
  const sourceRackBackOffsetX = -0.833333;
  const sourceRollerCenterA = new THREE.Vector2(-33.216357, 1);
  const sourceRollerRadius = 2;
  const sourceChainGuideRadius = 16.5;
  const sourceChainRodBaselineY = -9;
  const sourceRawChainAttachment = new THREE.Vector2(
    -15.420934,
    5.901815,
  );
  const sourceChainAttachmentAngle = Math.atan2(
    sourceRawChainAttachment.y,
    sourceRawChainAttachment.x,
  );
  const sourceChainLinkPitch = 1.5;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const beamPivotF = sourceBeamPivotF.clone().multiplyScalar(sourceScale);
  const beamHalfSwing = sourceBeamHalfSwing;
  const sectorPitchRadius = sourceSectorPitchRadius * sourceScale;
  const sectorRootRadius = sourceSectorRootRadius * sourceScale;
  const sectorOuterRadius = sourceSectorOuterRadius * sourceScale;
  const sectorAngularPitch = FULL_TURN / sourceSectorEquivalentTeeth;
  const rackToothPitch = sectorPitchRadius * sectorAngularPitch;
  const rackOriginX = sourceRackOriginX * sourceScale;
  const rackBackOffsetX = sourceRackBackOffsetX * sourceScale;
  const rollerCenterA = sourceRollerCenterA.clone().multiplyScalar(sourceScale);
  const rollerRadius = sourceRollerRadius * sourceScale;
  const chainGuideRadius = sourceChainGuideRadius * sourceScale;
  const chainRodBaselineY = sourceChainRodBaselineY * sourceScale;
  const chainAttachment = new THREE.Vector2(
    chainGuideRadius * Math.cos(sourceChainAttachmentAngle),
    chainGuideRadius * Math.sin(sourceChainAttachmentAngle),
  );
  const rawChainAttachment = sourceRawChainAttachment.clone()
    .multiplyScalar(sourceScale);
  const chainAttachmentRadialResidual = rawChainAttachment.length()
    - chainGuideRadius;
  const chainLinkPitch = sourceChainLinkPitch * sourceScale;
  const chainLinkCount = 10;
  const rackFirstToothCenterY = -7.853982 * sourceScale;
  const beamPlaneZ = 0.10;
  const rackPlaneZ = 0.10;
  const initialRackY = sectorPitchRadius * beamHalfSwing;
  const constantChainPathLength = -chainRodBaselineY
    + chainGuideRadius * (Math.PI - sourceChainAttachmentAngle);

  const geometry = {
    beamHalfSwing,
    beamPivotF,
    beamPlaneZ,
    chainAttachment,
    chainAttachmentRadialResidual,
    chainGuideRadius,
    chainLinkCount,
    chainLinkPitch,
    chainRodBaselineY,
    constantChainPathLength,
    cyclePeriod,
    initialRackY,
    inputAngularSpeed,
    rackBackOffsetX,
    rackFirstToothCenterY,
    rackOriginX,
    rackPlaneZ,
    rackStroke: 2 * sectorPitchRadius * beamHalfSwing,
    rackToothCount: sourceRackToothCount,
    rackToothPitch,
    rollerCenterA,
    rollerRadius,
    sectorAngularPitch,
    sectorEquivalentTeeth: sourceSectorEquivalentTeeth,
    sectorOuterRadius,
    sectorPitchRadius,
    sectorRootRadius,
    sectorToothCount: sourceSectorToothCount,
    sourceScale,
    suspensionRodStroke: 2 * chainGuideRadius * beamHalfSwing,
  };

  const chainPointAtDistance = (state, distanceFromRod) => {
    const distance = Math.min(
      Math.max(distanceFromRod, 0),
      state.chainPathLength,
    );
    if (distance <= state.chainStraightLength) {
      return {
        acceleration: new THREE.Vector2(0, state.chainRodAccelerationY),
        angularAcceleration: 0,
        angularVelocity: 0,
        curve: 'vertical-free-part',
        pathAngle: Math.PI / 2,
        point: new THREE.Vector2(
          -chainGuideRadius,
          state.chainRodTopY + distance,
        ),
        velocity: new THREE.Vector2(0, state.chainRodVelocityY),
      };
    }
    const arcDistance = distance - state.chainStraightLength;
    const angle = Math.PI - arcDistance / chainGuideRadius;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    return {
      acceleration: new THREE.Vector2(
        -chainGuideRadius * (
          cosine * state.beamAngularVelocity ** 2
            + sine * state.beamAngularAcceleration
        ),
        chainGuideRadius * (
          -sine * state.beamAngularVelocity ** 2
            + cosine * state.beamAngularAcceleration
        ),
      ),
      angularAcceleration: state.beamAngularAcceleration,
      angularVelocity: state.beamAngularVelocity,
      curve: 'circular-shoe-part',
      pathAngle: angle - Math.PI / 2,
      point: new THREE.Vector2(
        chainGuideRadius * cosine,
        chainGuideRadius * sine,
      ),
      velocity: new THREE.Vector2(
        -chainGuideRadius * sine * state.beamAngularVelocity,
        chainGuideRadius * cosine * state.beamAngularVelocity,
      ),
    };
  };

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const unwrappedInputAngle = inputTravel;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const beamAngle = -beamHalfSwing * cosine;
    const beamAngularVelocity = beamHalfSwing * sine
      * resolvedInputAngularSpeed;
    const beamAngularAcceleration = beamHalfSwing * (
      cosine * resolvedInputAngularSpeed ** 2
        + sine * inputAngularAcceleration
    );
    const rackY = -sectorPitchRadius * beamAngle;
    const rackVelocityY = -sectorPitchRadius * beamAngularVelocity;
    const rackAccelerationY = -sectorPitchRadius * beamAngularAcceleration;
    const rollerAngle = (rackY - initialRackY) / rollerRadius;
    const rollerAngularVelocity = rackVelocityY / rollerRadius;
    const rollerAngularAcceleration = rackAccelerationY / rollerRadius;
    const chainRodTopY = chainRodBaselineY
      - chainGuideRadius * beamAngle;
    const chainRodVelocityY = -chainGuideRadius * beamAngularVelocity;
    const chainRodAccelerationY = -chainGuideRadius
      * beamAngularAcceleration;
    const chainAttachmentAngle = sourceChainAttachmentAngle + beamAngle;
    const chainAttachmentPoint = new THREE.Vector2(
      chainGuideRadius * Math.cos(chainAttachmentAngle),
      chainGuideRadius * Math.sin(chainAttachmentAngle),
    );
    const chainAttachmentVelocity = new THREE.Vector2(
      -chainAttachmentPoint.y * beamAngularVelocity,
      chainAttachmentPoint.x * beamAngularVelocity,
    );
    const chainAttachmentAcceleration = new THREE.Vector2(
      -chainAttachmentPoint.x * beamAngularVelocity ** 2
        - chainAttachmentPoint.y * beamAngularAcceleration,
      -chainAttachmentPoint.y * beamAngularVelocity ** 2
        + chainAttachmentPoint.x * beamAngularAcceleration,
    );
    const chainStraightLength = -chainRodTopY;
    const chainArcLength = chainGuideRadius
      * (Math.PI - chainAttachmentAngle);
    const chainPathLength = chainStraightLength + chainArcLength;
    const pitchContactPoint = new THREE.Vector2(-sectorPitchRadius, 0);
    const rollerContactPoint = new THREE.Vector2(
      rollerCenterA.x + rollerRadius,
      rollerCenterA.y,
    );
    const localRackContactY = -rackY;
    const localSectorContactAngle = Math.PI - beamAngle;

    return {
      beamAngle,
      beamAngularAcceleration,
      beamAngularVelocity,
      chainArcLength,
      chainAttachmentAcceleration,
      chainAttachmentAngle,
      chainAttachmentPoint,
      chainAttachmentVelocity,
      chainPathLength,
      chainRodAccelerationY,
      chainRodTopY,
      chainRodVelocityY,
      chainStraightLength,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      localRackContactY,
      localSectorContactAngle,
      pitchContactPoint,
      rackAccelerationY,
      rackPosition: new THREE.Vector2(rackOriginX, rackY),
      rackVelocityY,
      rackY,
      rollerAngle,
      rollerAngularAcceleration,
      rollerAngularVelocity,
      rollerContactPoint,
      sectorPitchSurfaceVelocityY:
        -sectorPitchRadius * beamAngularVelocity,
      suspensionShoeSurfaceVelocityAtTangent:
        -chainGuideRadius * beamAngularVelocity,
      unwrappedInputAngle,
    };
  };

  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    rackUpperStroke: 0,
    midStrokeDescending: cyclePeriod / 4,
    rackLowerStroke: cyclePeriod / 2,
    midStrokeAscending: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([key, time]) => [key, stateAtTime(time)]),
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const beamMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const rackMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const chainMaterial = matte(0x4d8963, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-engine-bed-pivot-F-and-backing-roller-A';
  const frameMinimumX = -38.764161 * sourceScale;
  const frameMaximumX = 11.235839 * sourceScale;
  const frameLength = frameMaximumX - frameMinimumX;
  const frameCenterX = (frameMinimumX + frameMaximumX) / 2;
  const frameRails = [-2, 2].map((sourceY, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(frameLength, 0.09, 0.48),
      frameMaterial,
    );
    rail.position.set(frameCenterX, sourceY * sourceScale, -0.48);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-engine-guide-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const lowerBed = new THREE.Mesh(
    new THREE.BoxGeometry(frameLength, 3 * sourceScale, 0.64),
    frameMaterial,
  );
  lowerBed.position.set(frameCenterX, -2.5 * sourceScale, -0.62);
  lowerBed.userData.fixed = true;
  lowerBed.userData.role = 'fixed-foundation-bed-below-rack-and-rods';
  fixedFrame.add(lowerBed);

  const pivotPedestal = new THREE.Group();
  pivotPedestal.position.set(0, 0, 0);
  pivotPedestal.userData.fixed = true;
  pivotPedestal.userData.role = 'fixed-pedestal-and-bearing-F';
  const pivotShaft = cylinderAlongZ(0.30 * sourceScale, 1.25,
    darkMaterial, 38);
  pivotShaft.position.z = -0.12;
  pivotShaft.userData.fixed = true;
  pivotShaft.userData.role = 'fixed-shaft-through-beam-pivot-F';
  const pivotBearing = cylinderAlongZ(0.82 * sourceScale, 0.34,
    frameMaterial, 42);
  pivotBearing.position.z = -0.36;
  pivotBearing.userData.fixed = true;
  pivotBearing.userData.role = 'fixed-bearing-housing-F';
  const pedestalFoot = new THREE.Mesh(
    new THREE.BoxGeometry(4.0 * sourceScale, 0.55 * sourceScale, 0.72),
    frameMaterial,
  );
  pedestalFoot.position.set(0, -2.25 * sourceScale, -0.52);
  pedestalFoot.userData.fixed = true;
  pedestalFoot.userData.role = 'fixed-foot-under-bearing-F';
  const pedestalPost = beamBetween(
    new THREE.Vector2(0, -2.05 * sourceScale),
    new THREE.Vector2(0, -0.45 * sourceScale),
    0.34,
    0.55,
    frameMaterial,
    -0.50,
  );
  pedestalPost.userData.fixed = true;
  pedestalPost.userData.role = 'fixed-post-under-bearing-F';
  pivotPedestal.add(pivotShaft, pivotBearing, pedestalFoot, pedestalPost);
  fixedFrame.add(pivotPedestal);

  const rollerStand = new THREE.Group();
  rollerStand.position.set(rollerCenterA.x, rollerCenterA.y, 0);
  rollerStand.userData.fixed = true;
  rollerStand.userData.role = 'fixed-stand-for-backing-roller-A';
  const rollerShaft = cylinderAlongZ(0.30 * rollerRadius, 1.02,
    darkMaterial, 32);
  rollerShaft.position.z = -0.04;
  rollerShaft.userData.fixed = true;
  rollerShaft.userData.role = 'fixed-axis-of-backing-roller-A';
  const rollerPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 2.3 * sourceScale, 0.55),
    frameMaterial,
  );
  rollerPost.position.set(0, -rollerRadius - 1.15 * sourceScale, -0.52);
  rollerPost.userData.fixed = true;
  rollerPost.userData.role = 'fixed-pedestal-under-roller-A';
  rollerStand.add(rollerShaft, rollerPost);
  fixedFrame.add(rollerStand);
  root.add(fixedFrame);

  const rollerA = new THREE.Group();
  rollerA.position.set(rollerCenterA.x, rollerCenterA.y, 0);
  rollerA.userData.axis = Z_AXIS.clone();
  rollerA.userData.role = 'free-backing-roller-A';
  const rollerDisk = cylinderAlongZ(rollerRadius, 0.36,
    chainMaterial, 48);
  rollerDisk.position.z = 0.29;
  rollerDisk.userData.role = 'working-tread-of-backing-roller-A';
  const rollerHub = cylinderAlongZ(0.28 * rollerRadius, 0.38,
    darkMaterial, 32);
  rollerHub.position.z = 0.295;
  rollerHub.userData.role = 'hub-of-free-backing-roller-A';
  const rollerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(1.45 * rollerRadius, 0.05, 0.035),
    whiteMaterial,
  );
  rollerIndex.position.set(0.28 * rollerRadius, 0, 0.50);
  rollerIndex.userData.role = 'visible-radial-index-on-roller-A';
  rollerA.add(rollerDisk, rollerHub, rollerIndex);
  root.add(rollerA);

  const beamParts = makeBeamAndSectors({
    beamMaterial,
    darkMaterial,
    geometry,
    whiteMaterial,
  });
  root.add(beamParts.beam);

  const rackParts = makeRack({
    darkMaterial,
    geometry,
    rackMaterial,
    whiteMaterial,
  });
  root.add(rackParts.rack);

  const chainRod = new THREE.Group();
  chainRod.position.x = -chainGuideRadius;
  chainRod.userData.axis = new THREE.Vector3(0, 1, 0);
  chainRod.userData.role = 'vertical-rod-suspended-from-articulated-chain-D';
  const chainRodBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.30 * sourceScale, 20 * sourceScale, 0.15),
    chainMaterial,
  );
  chainRodBody.position.set(0, -10 * sourceScale, 0.58);
  chainRodBody.userData.role = 'straight-output-rod-below-chain-D';
  const chainRodTopBoss = cylinderAlongZ(0.47 * sourceScale, 0.17,
    chainMaterial, 30);
  chainRodTopBoss.position.z = 0.58;
  chainRodTopBoss.userData.role = 'top-eye-of-chain-suspended-rod';
  const chainRodTopPin = cylinderAlongZ(0.15 * sourceScale, 0.20,
    darkMaterial, 24);
  chainRodTopPin.position.z = 0.58;
  chainRodTopPin.userData.role = 'pin-joining-chain-to-suspended-rod';
  const chainRodTopAnchor = new THREE.Object3D();
  chainRodTopAnchor.position.z = 0.58;
  chainRodTopAnchor.userData.role = 'analytic-top-of-chain-suspended-rod';
  chainRod.add(
    chainRodBody,
    chainRodTopBoss,
    chainRodTopPin,
    chainRodTopAnchor,
  );
  root.add(chainRod);

  const chainLinks = Array.from({ length: chainLinkCount }, (_, index) => {
    const parts = makeFlexibleChainLink({
      chainMaterial,
      darkMaterial,
      depth: 0.13,
      nominalPitch: chainLinkPitch,
      width: 0.94 * sourceScale,
    });
    parts.link.userData.index = index;
    root.add(parts.link);
    return parts;
  });
  const chainTerminalConnector = new THREE.Mesh(
    new THREE.BoxGeometry(
      constantChainPathLength - chainLinkCount * chainLinkPitch,
      0.08,
      0.12,
    ),
    chainMaterial,
  );
  chainTerminalConnector.position.z = 0.58;
  chainTerminalConnector.userData.role =
    'short-terminal-connector-from-last-chain-link-to-beam-D';
  root.add(chainTerminalConnector);

  const pitchContactAnchor = new THREE.Object3D();
  pitchContactAnchor.position.set(-sectorPitchRadius, 0, 0.25);
  pitchContactAnchor.userData.role =
    'fixed-spatial-marker-at-rack-sector-pitch-contact';
  const rollerContactAnchor = new THREE.Object3D();
  rollerContactAnchor.position.set(
    rollerCenterA.x + rollerRadius,
    rollerCenterA.y,
    0.25,
  );
  rollerContactAnchor.userData.role =
    'fixed-spatial-marker-at-rack-back-roller-contact';
  const pivotFAnchor = new THREE.Object3D();
  pivotFAnchor.position.set(0, 0, beamPlaneZ);
  pivotFAnchor.userData.role = 'analytic-fixed-pivot-F';
  root.add(pitchContactAnchor, rollerContactAnchor, pivotFAnchor);

  const contacts = {
    beamPivotF: {
      fixedMember: pivotPedestal,
      movingMember: beamParts.beam,
      point: new THREE.Vector3(0, 0, beamPlaneZ),
      type: 'fixed-revolute-pair-F',
    },
    chainAtBeamD: {
      members: [beamParts.beam, ...chainLinks.map(({ link }) => link)],
      point: new THREE.Vector3(),
      type: 'pinned-chain-end-on-rocking-beam-D',
    },
    chainShoeTangent: {
      members: [beamParts.chainShoe,
        ...chainLinks.map(({ link }) => link)],
      point: new THREE.Vector3(-chainGuideRadius, 0, 0.58),
      type: 'tangent-continuous-flexible-chain-on-circular-shoe',
    },
    rackBackAtRollerA: {
      fixedAxisMember: rollerStand,
      members: [rackParts.rack, rollerA],
      point: new THREE.Vector3(
        rollerCenterA.x + rollerRadius,
        rollerCenterA.y,
        rackPlaneZ,
      ),
      type: 'rolling-line-contact-without-slip',
    },
    sectorRackPitchLine: {
      members: [beamParts.beam, rackParts.rack],
      point: new THREE.Vector3(-sectorPitchRadius, 0, rackPlaneZ),
      type: 'straight-rack-circular-sector-pitch-contact',
    },
  };

  const placeSpan = (mesh, start, end) => {
    const delta = end.clone().sub(start);
    mesh.position.set(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      0.58,
    );
    mesh.rotation.z = Math.atan2(delta.y, delta.x);
    mesh.scale.x = delta.length()
      / (constantChainPathLength - chainLinkCount * chainLinkPitch);
  };

  const update = (time) => {
    const state = stateAtTime(time);
    beamParts.beam.rotation.z = state.beamAngle;
    beamParts.beam.userData.angularSpeed = state.beamAngularVelocity;
    beamParts.beam.userData.angularAcceleration =
      state.beamAngularAcceleration;
    rackParts.rack.position.y = state.rackY;
    rackParts.rack.userData.velocity = new THREE.Vector3(
      0,
      state.rackVelocityY,
      0,
    );
    rollerA.rotation.z = state.rollerAngle;
    rollerA.userData.angularSpeed = state.rollerAngularVelocity;
    rollerA.userData.angularAcceleration = state.rollerAngularAcceleration;
    chainRod.position.y = state.chainRodTopY;
    chainRod.userData.velocity = new THREE.Vector3(
      0,
      state.chainRodVelocityY,
      0,
    );

    chainLinks.forEach((parts, index) => {
      const start = chainPointAtDistance(state, index * chainLinkPitch).point;
      const end = chainPointAtDistance(
        state,
        (index + 1) * chainLinkPitch,
      ).point;
      const delta = end.clone().sub(start);
      const chordLength = delta.length();
      parts.link.position.set(start.x, start.y, 0);
      parts.link.rotation.z = Math.atan2(delta.y, delta.x);
      parts.body.scale.x = chordLength / chainLinkPitch;
      parts.body.position.x = chordLength / 2;
      parts.endBoss.position.x = chordLength;
      parts.endPin.position.x = chordLength;
      parts.endAnchor.position.x = chordLength;
      parts.link.userData.chordLength = chordLength;
      parts.link.userData.startCurve = chainPointAtDistance(
        state,
        index * chainLinkPitch,
      ).curve;
      parts.link.userData.endCurve = chainPointAtDistance(
        state,
        (index + 1) * chainLinkPitch,
      ).curve;
    });
    const lastChainPoint = chainPointAtDistance(
      state,
      chainLinkCount * chainLinkPitch,
    ).point;
    placeSpan(chainTerminalConnector,
      lastChainPoint, state.chainAttachmentPoint);

    contacts.chainAtBeamD.point.set(
      state.chainAttachmentPoint.x,
      state.chainAttachmentPoint.y,
      0.58,
    );
    contacts.rackBackAtRollerA.rackSurfaceVelocity = new THREE.Vector3(
      0,
      state.rackVelocityY,
      0,
    );
    contacts.rackBackAtRollerA.rollerSurfaceVelocity = new THREE.Vector3(
      0,
      state.rollerAngularVelocity * rollerRadius,
      0,
    );
    contacts.rackBackAtRollerA.surfaceVelocityError =
      contacts.rackBackAtRollerA.rackSurfaceVelocity.clone().sub(
        contacts.rackBackAtRollerA.rollerSurfaceVelocity,
      );
    contacts.sectorRackPitchLine.rackSurfaceVelocity = new THREE.Vector3(
      0,
      state.rackVelocityY,
      0,
    );
    contacts.sectorRackPitchLine.sectorSurfaceVelocity = new THREE.Vector3(
      0,
      state.sectorPitchSurfaceVelocityY,
      0,
    );
    contacts.sectorRackPitchLine.surfaceVelocityError =
      contacts.sectorRackPitchLine.rackSurfaceVelocity.clone().sub(
        contacts.sectorRackPitchLine.sectorSurfaceVelocity,
      );
    contacts.chainShoeTangent.chainSurfaceVelocity = new THREE.Vector3(
      0,
      state.chainRodVelocityY,
      0,
    );
    contacts.chainShoeTangent.shoeSurfaceVelocity = new THREE.Vector3(
      0,
      state.suspensionShoeSurfaceVelocityAtTangent,
      0,
    );
    contacts.chainShoeTangent.surfaceVelocityError =
      contacts.chainShoeTangent.chainSurfaceVelocity.clone().sub(
        contacts.chainShoeTangent.shoeSurfaceVelocity,
      );
    contacts.chainShoeTangent.pathLength = state.chainPathLength;
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-36.685185, -21);
  const officialViewWidth = 42;
  const officialViewHeight = 42;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = point.y / sourceScale;
    return new THREE.Vector2(
      (sourceX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (sourceY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  root.userData.archetype =
    'single-acting-beam-engine-rack-sector-and-chain-parallel-motion';
  root.userData.blocks = {
    beam: beamParts.beam,
    beamBody: beamParts.body,
    beamChainAttachmentAnchor: beamParts.chainAttachmentAnchor,
    beamChainAttachmentBoss: beamParts.chainAttachmentBoss,
    beamPivotBore: beamParts.pivotBore,
    beamPivotBoss: beamParts.pivotBoss,
    beamRotationIndex: beamParts.rotationIndex,
    chainLinks,
    chainRod,
    chainRodBody,
    chainRodTopAnchor,
    chainRodTopBoss,
    chainRodTopPin,
    chainShoe: beamParts.chainShoe,
    chainTerminalConnector,
    fixedFrame,
    frameRails,
    lowerBed,
    pitchContactAnchor,
    pivotFAnchor,
    pivotPedestal,
    pivotShaft,
    rack: rackParts.rack,
    rackBackLineAnchor: rackParts.backLineAnchor,
    rackBody: rackParts.body,
    rackOriginAnchor: rackParts.originAnchor,
    rackTeeth: rackParts.rackTeeth,
    rollerA,
    rollerContactAnchor,
    rollerDisk,
    rollerHub,
    rollerIndex,
    rollerShaft,
    rollerStand,
    sectorSpokes: beamParts.sectorSpokes,
    sectorTeeth: beamParts.sectorTeeth,
    sectorWeb: beamParts.sectorWeb,
  };
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.35, -5.25, -0.95),
    new THREE.Vector3(1.90, 2.65, 1.10),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.chainPointAtDistance = chainPointAtDistance;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one prescribed harmonic rocking angle of beam D about F',
    mechanism: 1,
    outputs:
      'rack-and-piston rod B and the chain-suspended rod both translate vertically',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -5.28;
  root.userData.mechanism =
    'single-acting-beam-engine-with-straight-rack-B-sector-C-backing-roller-A-and-chain-suspension-D';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_stat',
      'add_stat',
      'add_pos_interp',
      'add_pos_interp',
      'add_pos_interp',
      'add_belt',
    ],
    officialGeometry: {
      beamDirectionEnd: new THREE.Vector2(2.897777, 0.776457),
      beamDirectionStart: new THREE.Vector2(2.897777, -0.776457),
      beamHalfSwing: sourceBeamHalfSwing,
      beamPivotF: sourceBeamPivotF,
      chainGuideRadius: sourceChainGuideRadius,
      chainLinkPitch: sourceChainLinkPitch,
      chainRodEndLine: [
        new THREE.Vector2(-16.5, -13.31969),
        new THREE.Vector2(-14.5, -13.31969),
      ],
      chainRodStartLine: [
        new THREE.Vector2(-16.5, -4.68031),
        new THREE.Vector2(-14.5, -4.68031),
      ],
      rackEndLine: [
        new THREE.Vector2(-30.383024, -7.853982),
        new THREE.Vector2(-29.383024, -7.853982),
      ],
      rackOriginX: sourceRackOriginX,
      rackStartLine: [
        new THREE.Vector2(-30.383024, 7.853982),
        new THREE.Vector2(-29.383024, 7.853982),
      ],
      rackToothCount: sourceRackToothCount,
      rawChainAttachment: sourceRawChainAttachment,
      rollerCenterA: sourceRollerCenterA,
      rollerRadius: sourceRollerRadius,
      sectorEquivalentTeeth: sourceSectorEquivalentTeeth,
      sectorOuterRadius: sourceSectorOuterRadius,
      sectorPitchRadius: sourceSectorPitchRadius,
      sectorRootRadius: sourceSectorRootRadius,
      sectorToothCount: sourceSectorToothCount,
    },
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'the source endpoints are rounded to six decimals; this model uses the intended exact 15-degree swing, 30-unit rack-sector pitch radius, and 16.5-unit constant-length chain path',
    referenceScope:
      'official beam and rack endpoint transforms, tooth geometry and phase, roller A, articulated chain D, fixed frame landmarks, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate334: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'beam D pivots at F, sector C meshes with straight piston rack B, roller A backs the rack, and a chain follows the concentric D shoe',
      labels: ['A', 'B', 'C', 'D', 'F'],
      measurementUncertaintyPixels: 4,
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    chainSuspension:
      'the D rod moves -16.5 theta while ten articulated links unwrap tangentially from the concentric shoe',
    exactConstraints:
      'rack travel y_B=-30 theta, roller A obeys omega_A=v_B/2, and chain-rod travel y_D=-9-16.5 theta in source units',
    rackSector:
      'the 180-tooth-equivalent sector C and straight rack B share a 1.047197551-unit circular pitch without slip',
    rollerA:
      'the rack back remains tangent to the two-unit free roller and spins it without slip',
  };

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.4, 3.7, 13.8),
    root,
    update,
  };
}

function stationaryBeamEngineParallelMotion(movement) {
  const root = new THREE.Group();

  // The engraving is sparse, and the source site explicitly describes its
  // animated interpretation as uncertain. Its proposed topology is coherent:
  // a 12/6-unit ternary beam drives two 3.5-unit links, while a six-unit
  // fixed radius and a six-unit crossbar complete the lower cell. The source
  // forces the piston point onto x=-12, leaving a tiny E-Q length residual.
  // Here every visible member is rigid and E follows the resulting historical
  // near-straight locus; both differences are retained as measured metadata.
  const sourceScale = 0.36;
  const sourceBeamPivotO = new THREE.Vector2(0, 0);
  const sourceHiddenCrankPivot = new THREE.Vector2(12.375, -12);
  const sourceHiddenCrankRadius = 2.083778;
  const sourceHiddenDriveRodLength = 12.179578;
  const sourceBeamDriverRadius = 12.375;
  const sourceBeamLeftStationRadius = 12;
  const sourceBeamMiddleStationRadius = 6;
  const sourceDropLinkLength = 3.5;
  const sourceFixedRadiusPivotF = new THREE.Vector2(-12, -3.5);
  const sourceFixedRadiusLength = 6;
  const sourceCrossbarLength = 6;
  const sourceStrokeLineX = -12;
  const sourceInputPhaseOffset = FULL_TURN * 0.125;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const beamPivotO = sourceBeamPivotO.clone().multiplyScalar(sourceScale);
  const hiddenCrankPivot = sourceHiddenCrankPivot.clone()
    .multiplyScalar(sourceScale);
  const hiddenCrankRadius = sourceHiddenCrankRadius * sourceScale;
  const hiddenDriveRodLength = sourceHiddenDriveRodLength * sourceScale;
  const beamDriverRadius = sourceBeamDriverRadius * sourceScale;
  const beamLeftStationRadius = sourceBeamLeftStationRadius * sourceScale;
  const beamMiddleStationRadius = sourceBeamMiddleStationRadius * sourceScale;
  const dropLinkLength = sourceDropLinkLength * sourceScale;
  const fixedRadiusPivotF = sourceFixedRadiusPivotF.clone()
    .multiplyScalar(sourceScale);
  const fixedRadiusLength = sourceFixedRadiusLength * sourceScale;
  const crossbarLength = sourceCrossbarLength * sourceScale;
  const strokeLineX = sourceStrokeLineX * sourceScale;
  const zero = new THREE.Vector2();

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const unwrappedInputAngle = inputTravel;
    const inputAngle = positiveModulo(
      sourceInputPhaseOffset + unwrappedInputAngle,
      FULL_TURN,
    );
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const inputCrankPin = hiddenCrankPivot.clone().add(
      new THREE.Vector2(cosine, sine).multiplyScalar(hiddenCrankRadius),
    );
    const inputCrankPinVelocity = new THREE.Vector2(
      -hiddenCrankRadius * sine * resolvedInputAngularSpeed,
      hiddenCrankRadius * cosine * resolvedInputAngularSpeed,
    );
    const inputCrankPinAcceleration = new THREE.Vector2(
      -hiddenCrankRadius * (
        cosine * resolvedInputAngularSpeed ** 2
          + sine * inputAngularAcceleration
      ),
      hiddenCrankRadius * (
        -sine * resolvedInputAngularSpeed ** 2
          + cosine * inputAngularAcceleration
      ),
    );

    const beamDriverPoint = nearestPoint(
      circleCircleIntersections(
        beamPivotO,
        beamDriverRadius,
        inputCrankPin,
        hiddenDriveRodLength,
      ),
      new THREE.Vector2(beamDriverRadius, 0),
    );
    const beamDriverRates = constrainedPointRates({
      accelerationA: zero,
      accelerationB: inputCrankPinAcceleration,
      centerA: beamPivotO,
      centerB: inputCrankPin,
      point: beamDriverPoint,
      velocityA: zero,
      velocityB: inputCrankPinVelocity,
    });
    const beamRates = rigidLinkRates(
      beamDriverPoint,
      beamDriverRates.velocity,
      beamDriverRates.acceleration,
    );
    const leftStationScale = -beamLeftStationRadius / beamDriverRadius;
    const middleStationScale = -beamMiddleStationRadius / beamDriverRadius;
    const pointA = beamDriverPoint.clone().multiplyScalar(leftStationScale);
    const pointAVelocity = beamDriverRates.velocity.clone()
      .multiplyScalar(leftStationScale);
    const pointAAcceleration = beamDriverRates.acceleration.clone()
      .multiplyScalar(leftStationScale);
    const pointB = beamDriverPoint.clone().multiplyScalar(middleStationScale);
    const pointBVelocity = beamDriverRates.velocity.clone()
      .multiplyScalar(middleStationScale);
    const pointBAcceleration = beamDriverRates.acceleration.clone()
      .multiplyScalar(middleStationScale);

    const verticalDeltaX = strokeLineX - pointA.x;
    const verticalDeltaY = -Math.sqrt(Math.max(
      0,
      dropLinkLength ** 2 - verticalDeltaX ** 2,
    ));
    const officialPointE = new THREE.Vector2(
      strokeLineX,
      pointA.y + verticalDeltaY,
    );
    const officialPointEVelocity = new THREE.Vector2(
      0,
      pointAVelocity.y
        + verticalDeltaX * pointAVelocity.x / verticalDeltaY,
    );
    const officialRelativeVelocity = officialPointEVelocity.clone()
      .sub(pointAVelocity);
    const officialPointEAcceleration = new THREE.Vector2(
      0,
      pointAAcceleration.y + (
        verticalDeltaX * pointAAcceleration.x
          - officialRelativeVelocity.lengthSq()
      ) / verticalDeltaY,
    );

    const pointQ = nearestPoint(
      circleCircleIntersections(
        pointB,
        dropLinkLength,
        fixedRadiusPivotF,
        fixedRadiusLength,
      ),
      new THREE.Vector2(-6, -3.5).multiplyScalar(sourceScale),
    );
    const pointQRates = constrainedPointRates({
      accelerationA: pointBAcceleration,
      accelerationB: zero,
      centerA: pointB,
      centerB: fixedRadiusPivotF,
      point: pointQ,
      velocityA: pointBVelocity,
      velocityB: zero,
    });
    const pointE = nearestPoint(
      circleCircleIntersections(
        pointA,
        dropLinkLength,
        pointQ,
        crossbarLength,
      ),
      officialPointE,
    );
    const pointERates = constrainedPointRates({
      accelerationA: pointAAcceleration,
      accelerationB: pointQRates.acceleration,
      centerA: pointA,
      centerB: pointQ,
      point: pointE,
      velocityA: pointAVelocity,
      velocityB: pointQRates.velocity,
    });

    const leftDropVector = pointE.clone().sub(pointA);
    const leftDropVelocity = pointERates.velocity.clone()
      .sub(pointAVelocity);
    const leftDropAcceleration = pointERates.acceleration.clone()
      .sub(pointAAcceleration);
    const middleDropVector = pointQ.clone().sub(pointB);
    const middleDropVelocity = pointQRates.velocity.clone()
      .sub(pointBVelocity);
    const middleDropAcceleration = pointQRates.acceleration.clone()
      .sub(pointBAcceleration);
    const fixedRadiusVector = pointQ.clone().sub(fixedRadiusPivotF);
    const crossbarVector = pointQ.clone().sub(pointE);
    const crossbarVelocity = pointQRates.velocity.clone()
      .sub(pointERates.velocity);
    const crossbarAcceleration = pointQRates.acceleration.clone()
      .sub(pointERates.acceleration);
    const driveRodVector = beamDriverPoint.clone().sub(inputCrankPin);
    const driveRodVelocity = beamDriverRates.velocity.clone()
      .sub(inputCrankPinVelocity);
    const driveRodAcceleration = beamDriverRates.acceleration.clone()
      .sub(inputCrankPinAcceleration);

    return {
      beam: beamRates,
      beamDriverPoint,
      beamDriverPointAcceleration: beamDriverRates.acceleration,
      beamDriverPointVelocity: beamDriverRates.velocity,
      crossbar: rigidLinkRates(
        crossbarVector,
        crossbarVelocity,
        crossbarAcceleration,
      ),
      driveRod: rigidLinkRates(
        driveRodVector,
        driveRodVelocity,
        driveRodAcceleration,
      ),
      fixedRadius: rigidLinkRates(
        fixedRadiusVector,
        pointQRates.velocity,
        pointQRates.acceleration,
      ),
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      inputCrankPin,
      inputCrankPinAcceleration,
      inputCrankPinVelocity,
      leftDrop: rigidLinkRates(
        leftDropVector,
        leftDropVelocity,
        leftDropAcceleration,
      ),
      middleDrop: rigidLinkRates(
        middleDropVector,
        middleDropVelocity,
        middleDropAcceleration,
      ),
      officialCanvasApproximation: {
        crossbarResidual: officialPointE.distanceTo(pointQ) - crossbarLength,
        pointE: officialPointE,
        pointEAcceleration: officialPointEAcceleration,
        pointEVelocity: officialPointEVelocity,
      },
      pistonLateralDeviation: pointE.x - strokeLineX,
      pistonVerticalDifferenceFromCanvas: pointE.y - officialPointE.y,
      pointA,
      pointAAcceleration,
      pointAVelocity,
      pointB,
      pointBAcceleration,
      pointBVelocity,
      pointE,
      pointEAcceleration: pointERates.acceleration,
      pointEVelocity: pointERates.velocity,
      pointQ,
      pointQAcceleration: pointQRates.acceleration,
      pointQVelocity: pointQRates.velocity,
      unwrappedInputAngle,
    };
  };

  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    sourceStart: 0,
    sourceQuarter: cyclePeriod / 4,
    sourceHalf: cyclePeriod / 2,
    sourceThreeQuarter: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([key, time]) => [key, stateAtTime(time)]),
  );

  let maximumOfficialCrossbarResidual = 0;
  let maximumPistonLateralDeviation = 0;
  let maximumPistonVerticalDifference = 0;
  let minimumBeamAngle = Infinity;
  let maximumBeamAngle = -Infinity;
  let minimumPistonY = Infinity;
  let maximumPistonY = -Infinity;
  let minimumOfficialPistonY = Infinity;
  let maximumOfficialPistonY = -Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(cyclePeriod * sample / 16384);
    maximumOfficialCrossbarResidual = Math.max(
      maximumOfficialCrossbarResidual,
      Math.abs(state.officialCanvasApproximation.crossbarResidual),
    );
    maximumPistonLateralDeviation = Math.max(
      maximumPistonLateralDeviation,
      Math.abs(state.pistonLateralDeviation),
    );
    maximumPistonVerticalDifference = Math.max(
      maximumPistonVerticalDifference,
      Math.abs(state.pistonVerticalDifferenceFromCanvas),
    );
    minimumBeamAngle = Math.min(minimumBeamAngle, state.beam.angle);
    maximumBeamAngle = Math.max(maximumBeamAngle, state.beam.angle);
    minimumPistonY = Math.min(minimumPistonY, state.pointE.y);
    maximumPistonY = Math.max(maximumPistonY, state.pointE.y);
    minimumOfficialPistonY = Math.min(
      minimumOfficialPistonY,
      state.officialCanvasApproximation.pointE.y,
    );
    maximumOfficialPistonY = Math.max(
      maximumOfficialPistonY,
      state.officialCanvasApproximation.pointE.y,
    );
  }

  const geometry = {
    beamDriverRadius,
    beamLeftStationRadius,
    beamMiddleStationRadius,
    beamPivotO,
    crossbarLength,
    cyclePeriod,
    dropLinkLength,
    fixedRadiusLength,
    fixedRadiusPivotF,
    hiddenCrankPivot,
    hiddenCrankRadius,
    hiddenDriveRodLength,
    inputAngularSpeed,
    maximumBeamAngle,
    maximumOfficialCrossbarResidual,
    maximumOfficialPistonY,
    maximumPistonLateralDeviation,
    maximumPistonVerticalDifference,
    maximumPistonY,
    minimumBeamAngle,
    minimumOfficialPistonY,
    minimumPistonY,
    officialOutputStroke: maximumOfficialPistonY - minimumOfficialPistonY,
    outputStroke: maximumPistonY - minimumPistonY,
    sourceInputPhaseOffset,
    sourceScale,
    strokeLineX,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const beamMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const linkMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const radiusMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const outputMaterial = matte(0xd78332, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-beam-fulcrum-O-radius-pivot-F-and-guide';
  const frameRails = [-4.125, -2.875].map((sourceY, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(6.2 * sourceScale, 0.10, 0.48),
      frameMaterial,
    );
    rail.position.set(-15.1 * sourceScale, sourceY * sourceScale, -0.50);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-left-crosshead-guide-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const outputGuideBack = new THREE.Mesh(
    new THREE.BoxGeometry(1.65 * sourceScale, 7.4 * sourceScale, 0.55),
    frameMaterial,
  );
  outputGuideBack.position.set(
    strokeLineX,
    -6.9 * sourceScale,
    -0.62,
  );
  outputGuideBack.userData.fixed = true;
  outputGuideBack.userData.role =
    'fixed-rear-guide-for-near-vertical-piston-rod';

  const pivotOBearing = cylinderAlongZ(1.50 * sourceScale, 0.42,
    frameMaterial, 46);
  pivotOBearing.position.z = -0.34;
  pivotOBearing.userData.fixed = true;
  pivotOBearing.userData.role = 'fixed-large-fulcrum-bearing-O';
  const pivotOShaft = cylinderAlongZ(0.38 * sourceScale, 1.18,
    darkMaterial, 34);
  pivotOShaft.position.z = -0.04;
  pivotOShaft.userData.fixed = true;
  pivotOShaft.userData.role = 'fixed-shaft-through-beam-fulcrum-O';
  const pivotOPost = new THREE.Mesh(
    new THREE.BoxGeometry(1.10 * sourceScale, 5.0 * sourceScale, 0.65),
    frameMaterial,
  );
  pivotOPost.position.set(0, -3.9 * sourceScale, -0.56);
  pivotOPost.userData.fixed = true;
  pivotOPost.userData.role = 'fixed-pedestal-under-fulcrum-O';

  const pivotFBearing = cylinderAlongZ(0.625 * sourceScale, 0.38,
    frameMaterial, 40);
  pivotFBearing.position.set(
    fixedRadiusPivotF.x,
    fixedRadiusPivotF.y,
    -0.32,
  );
  pivotFBearing.userData.fixed = true;
  pivotFBearing.userData.role = 'fixed-radius-bar-bearing-F';
  const pivotFShaft = cylinderAlongZ(0.25 * sourceScale, 1.04,
    darkMaterial, 32);
  pivotFShaft.position.set(
    fixedRadiusPivotF.x,
    fixedRadiusPivotF.y,
    0.02,
  );
  pivotFShaft.userData.fixed = true;
  pivotFShaft.userData.role = 'fixed-shaft-through-radius-pivot-F';
  fixedFrame.add(
    outputGuideBack,
    pivotOBearing,
    pivotOShaft,
    pivotOPost,
    pivotFBearing,
    pivotFShaft,
  );
  root.add(fixedFrame);

  const beam = new THREE.Group();
  beam.userData.axis = Z_AXIS.clone();
  beam.userData.role = 'twelve-six-unit-ternary-stationary-engine-beam';
  const beamBodyPoints = [
    new THREE.Vector2(-12.041667, -0.498261),
    new THREE.Vector2(-0.125, -1.494783),
    new THREE.Vector2(3.1, -1.10),
    new THREE.Vector2(3.1, 1.10),
    new THREE.Vector2(0.125, 1.494783),
    new THREE.Vector2(-12.041667, 0.498261),
  ].map((point) => point.multiplyScalar(sourceScale));
  const beamBody = new THREE.Mesh(
    centeredExtrusion(polygonShape(beamBodyPoints), 0.26, 0.008),
    beamMaterial,
  );
  beamBody.position.z = 0.10;
  beamBody.userData.role = 'rigid-tapered-stationary-engine-beam-body';
  const makeBeamBoss = (sourceX, sourceRadius, role) => {
    const boss = cylinderAlongZ(sourceRadius * sourceScale, 0.34,
      beamMaterial, 38);
    boss.position.set(sourceX * sourceScale, 0, 0.10);
    boss.userData.role = role;
    return boss;
  };
  const leftBossOuter = makeBeamBoss(-12, 0.50,
    'beam-left-station-A-large-boss');
  const leftBossInner = makeBeamBoss(-12, 0.25,
    'beam-left-station-A-pin-face');
  const middleBoss = makeBeamBoss(-6, 0.25,
    'beam-middle-station-B-boss');
  const pivotBoss = makeBeamBoss(0, 1.50,
    'large-beam-fulcrum-boss-O');
  const pivotBore = cylinderAlongZ(0.38 * sourceScale, 0.38,
    darkMaterial, 34);
  pivotBore.position.z = 0.105;
  pivotBore.userData.role = 'beam-fulcrum-bore-O';
  const rotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(1.8 * sourceScale, 0.055, 0.035),
    whiteMaterial,
  );
  rotationIndex.position.set(-0.70 * sourceScale, 0, 0.31);
  rotationIndex.userData.role = 'visible-index-on-rocking-engine-beam';
  const pointAAnchor = new THREE.Object3D();
  pointAAnchor.position.set(-beamLeftStationRadius, 0, 0.10);
  pointAAnchor.userData.role = 'analytic-beam-left-station-A';
  const pointBAnchor = new THREE.Object3D();
  pointBAnchor.position.set(-beamMiddleStationRadius, 0, 0.10);
  pointBAnchor.userData.role = 'analytic-beam-middle-station-B';
  const pivotOAnchor = new THREE.Object3D();
  pivotOAnchor.position.z = 0.10;
  pivotOAnchor.userData.role = 'analytic-fixed-beam-pivot-O';
  beam.add(
    beamBody,
    leftBossOuter,
    leftBossInner,
    middleBoss,
    pivotBoss,
    pivotBore,
    rotationIndex,
    pointAAnchor,
    pointBAnchor,
    pivotOAnchor,
  );
  root.add(beam);

  const leftDropParts = makePinnedRod({
    bodyMaterial: linkMaterial,
    depth: 0.17,
    eyeMaterial: darkMaterial,
    length: dropLinkLength,
    planeZ: 0.37,
    role: 'left-three-and-one-half-unit-link-A-E',
    width: 0.18,
  });
  const middleDropParts = makePinnedRod({
    bodyMaterial: linkMaterial,
    depth: 0.17,
    eyeMaterial: darkMaterial,
    length: dropLinkLength,
    planeZ: 0.40,
    role: 'middle-three-and-one-half-unit-link-B-Q',
    width: 0.18,
  });
  const fixedRadiusParts = makePinnedRod({
    bodyMaterial: radiusMaterial,
    depth: 0.17,
    eyeMaterial: darkMaterial,
    length: fixedRadiusLength,
    planeZ: 0.62,
    role: 'six-unit-fixed-radius-bar-F-Q',
    width: 0.17,
  });
  const crossbarParts = makePinnedRod({
    bodyMaterial: beamMaterial,
    depth: 0.17,
    eyeMaterial: darkMaterial,
    length: crossbarLength,
    planeZ: 0.84,
    role: 'six-unit-crossbar-E-Q',
    width: 0.17,
  });
  root.add(
    leftDropParts.rod,
    middleDropParts.rod,
    fixedRadiusParts.rod,
    crossbarParts.rod,
  );

  const piston = new THREE.Group();
  piston.userData.rotationDegreesOfFreedom = 0;
  piston.userData.role = 'near-vertical-piston-rod-carried-by-point-E';
  const crosshead = new THREE.Mesh(
    new THREE.BoxGeometry(1.125 * sourceScale, 1.625 * sourceScale, 0.30),
    outputMaterial,
  );
  crosshead.position.z = -0.08;
  crosshead.userData.role = 'rectangular-piston-crosshead-at-E';
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.375 * sourceScale, 7.2 * sourceScale, 0.17),
    outputMaterial,
  );
  pistonRod.position.set(0, -4.4 * sourceScale, -0.09);
  pistonRod.userData.role = 'straight-piston-rod-below-E';
  const pistonIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.55 * sourceScale, 0.035),
    whiteMaterial,
  );
  pistonIndex.position.set(0, -4.0 * sourceScale, 0.08);
  pistonIndex.userData.role = 'visible-index-on-translating-piston-rod';
  const pointEAnchor = new THREE.Object3D();
  pointEAnchor.position.z = 0.02;
  pointEAnchor.userData.role = 'analytic-piston-point-E';
  piston.add(crosshead, pistonRod, pistonIndex, pointEAnchor);
  root.add(piston);

  const jointPins = {
    A: cylinderAlongZ(0.16, 0.48, whiteMaterial, 30),
    B: cylinderAlongZ(0.13, 0.48, whiteMaterial, 30),
    E: cylinderAlongZ(0.14, 0.90, whiteMaterial, 30),
    Q: cylinderAlongZ(0.14, 0.72, whiteMaterial, 30),
  };
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
    root.add(pin);
  });

  const setRodPose = (rod, start, rates) => {
    rod.position.set(start.x, start.y, 0);
    rod.rotation.z = rates.angle;
  };
  const contacts = {
    beamPivotO: {
      fixedMember: fixedFrame,
      movingMember: beam,
      point: new THREE.Vector3(0, 0, 0.10),
      type: 'fixed-revolute-pair-O',
    },
    crossbarAtE: {
      members: [leftDropParts.rod, crossbarParts.rod, piston],
      point: new THREE.Vector3(),
      type: 'common-ternary-pin-E',
    },
    fourMembersAtQ: {
      members: [middleDropParts.rod, fixedRadiusParts.rod,
        crossbarParts.rod],
      point: new THREE.Vector3(),
      type: 'common-pin-Q',
    },
    leftDropAtA: {
      members: [beam, leftDropParts.rod],
      point: new THREE.Vector3(),
      type: 'revolute-pin-A',
    },
    middleDropAtB: {
      members: [beam, middleDropParts.rod],
      point: new THREE.Vector3(),
      type: 'revolute-pin-B',
    },
    radiusPivotF: {
      fixedMember: fixedFrame,
      movingMember: fixedRadiusParts.rod,
      point: new THREE.Vector3(
        fixedRadiusPivotF.x,
        fixedRadiusPivotF.y,
        0.62,
      ),
      type: 'fixed-revolute-pair-F',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beam.angle;
    beam.userData.angularSpeed = state.beam.angularVelocity;
    beam.userData.angularAcceleration = state.beam.angularAcceleration;
    setRodPose(leftDropParts.rod, state.pointA, state.leftDrop);
    setRodPose(middleDropParts.rod, state.pointB, state.middleDrop);
    setRodPose(fixedRadiusParts.rod, fixedRadiusPivotF, state.fixedRadius);
    setRodPose(crossbarParts.rod, state.pointE, state.crossbar);
    piston.position.set(state.pointE.x, state.pointE.y, 0);
    piston.userData.velocity = new THREE.Vector3(
      state.pointEVelocity.x,
      state.pointEVelocity.y,
      0,
    );
    jointPins.A.position.set(state.pointA.x, state.pointA.y, 0.31);
    jointPins.B.position.set(state.pointB.x, state.pointB.y, 0.32);
    jointPins.E.position.set(state.pointE.x, state.pointE.y, 0.44);
    jointPins.Q.position.set(state.pointQ.x, state.pointQ.y, 0.60);
    contacts.leftDropAtA.point.set(state.pointA.x, state.pointA.y, 0.28);
    contacts.middleDropAtB.point.set(state.pointB.x, state.pointB.y, 0.29);
    contacts.crossbarAtE.point.set(state.pointE.x, state.pointE.y, 0.43);
    contacts.fourMembersAtQ.point.set(state.pointQ.x, state.pointQ.y, 0.59);
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-14.951954, -10.75);
  const officialViewWidth = 18;
  const officialViewHeight = 18;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = point.y / sourceScale;
    return new THREE.Vector2(
      (sourceX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (sourceY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  root.userData.archetype =
    'stationary-beam-engine-six-bar-approximate-parallel-motion';
  root.userData.blocks = {
    beam,
    beamBody,
    beamLeftStationAnchor: pointAAnchor,
    beamMiddleStationAnchor: pointBAnchor,
    beamPivotAnchor: pivotOAnchor,
    beamPivotBoss: pivotBoss,
    beamRotationIndex: rotationIndex,
    crossbar: crossbarParts.rod,
    crossbarEndAnchor: crossbarParts.endAnchor,
    crossbarStartAnchor: crossbarParts.startAnchor,
    crosshead,
    fixedFrame,
    fixedRadiusBar: fixedRadiusParts.rod,
    fixedRadiusEndAnchor: fixedRadiusParts.endAnchor,
    fixedRadiusStartAnchor: fixedRadiusParts.startAnchor,
    frameRails,
    jointPins,
    leftDropLink: leftDropParts.rod,
    leftDropLinkEndAnchor: leftDropParts.endAnchor,
    leftDropLinkStartAnchor: leftDropParts.startAnchor,
    middleDropLink: middleDropParts.rod,
    middleDropLinkEndAnchor: middleDropParts.endAnchor,
    middleDropLinkStartAnchor: middleDropParts.startAnchor,
    outputGuideBack,
    piston,
    pistonPointAnchor: pointEAnchor,
    pistonRod,
    pivotOBearing,
    pivotOShaft,
    pivotFBearing,
    pivotFShaft,
  };
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.65, -4.55, -0.95),
    new THREE.Vector3(1.25, 2.65, 1.18),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input:
      'one hidden continuously rotating crank reconstructed from the source timing model',
    mechanism: 1,
    output:
      'piston point E follows the near-vertical coupler curve of the exact closed six-bar',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -4.58;
  root.userData.mechanism =
    'closed-rigid-stationary-beam-engine-parallel-motion-with-ternary-beam-A-B-O-drop-links-A-E-and-B-Q-radius-F-Q-and-crossbar-E-Q';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_stat',
      'add_rot',
      'add_c_rod_r',
      'add_rot_to',
      'add_c_rod',
      'add_tx',
      'add_c_rod_r',
      'add_rot_to',
      'add_rot_to',
    ],
    officialGeometry: {
      beamDriverRadius: sourceBeamDriverRadius,
      beamLeftStationRadius: sourceBeamLeftStationRadius,
      beamMiddleStationRadius: sourceBeamMiddleStationRadius,
      beamPivotO: sourceBeamPivotO,
      crossbarLength: sourceCrossbarLength,
      dropLinkLength: sourceDropLinkLength,
      fixedRadiusLength: sourceFixedRadiusLength,
      fixedRadiusPivotF: sourceFixedRadiusPivotF,
      hiddenCrankPivot: sourceHiddenCrankPivot,
      hiddenCrankRadius: sourceHiddenCrankRadius,
      hiddenDriveRodLength: sourceHiddenDriveRodLength,
      inputPhaseOffsetTurns: 0.125,
      strokeLine: [
        new THREE.Vector2(-12, -4.5),
        new THREE.Vector2(-12, -10.5),
      ],
    },
    officialNotes:
      'the source site says its animation illustrates the motion it thinks Brown intended because the original diagram lacks enough detail for certainty',
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'the official canvas forces E onto x=-12 and incurs a small E-Q residual; this model closes all four lower bars exactly and exposes the resulting sub-0.0011-unit lateral deviation of E',
    referenceScope:
      'official hidden crank and rod, beam stations A and B, both 3.5-unit drops, fixed pivot F, both 6-unit lower links, source branches, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate335: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'a fulcrumed beam carries two hanging links joined by a lower crossbar whose second endpoint is controlled by a fixed radius bar',
      interpretationCertain: false,
      measurementUncertaintyPixels: 5,
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    exactRigidConstraints:
      '|O-A|=12, |O-B|=6, |A-E|=3.5, |B-Q|=3.5, |F-Q|=6, and |E-Q|=6 source units',
    input:
      'a hidden 2.083778-unit crank and 12.179578-unit rod rock the 12.375-unit beam driver station',
    output:
      'point E carries the piston on an approximately straight vertical stroke',
    straightness:
      'the six-bar geometry makes E nearly straight; lateral deviation is measured rather than forced away',
    topology:
      'A-B-Q-E is an exact moving parallelogram whose point Q is controlled by fixed radius F-Q',
  };

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.2, 3.6, 13.5),
    root,
    update,
  };
}

export function createAuthoredBeamEngineParallelMotion(movement) {
  switch (movement.id) {
    case 334: return singleActingBeamRackParallelMotion(movement);
    case 335: return stationaryBeamEngineParallelMotion(movement);
    default: return null;
  }
}
