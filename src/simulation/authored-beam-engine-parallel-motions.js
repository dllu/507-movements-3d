import { involute } from './band-epicyclic-geometry.js';
import { makeBoredLinkRod } from './bored-link-rod.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
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

const makePinnedRod = makeBoredLinkRod;

function makeSectorToothGeometry({ depth, outerRadius, rootRadius, sourceScale }) {
  const pitchRadius = 30 * sourceScale;
  const baseRadius = pitchRadius * Math.cos(Math.PI / 9);
  const backlash = 0.006 * sourceScale;
  const halfAngle = radius => Math.PI / 360 - backlash / (2 * pitchRadius)
    + involute(pitchRadius / baseRadius) - involute(radius / baseRadius);
  const points = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 32; i += 1) {
      const fraction = side < 0 ? i / 32 : 1 - i / 32;
      const radius = rootRadius + fraction * (outerRadius - rootRadius);
      const angle = side * halfAngle(radius);
      points.push(new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle)));
    }
  }
  const geometry = centeredExtrusion(polygonShape(points), depth, 0);
  geometry.userData.involute = { pitchRadius, baseRadius, pressureAngle: Math.PI / 9, backlash };
  return geometry;
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

  // The plate carries the box beam out to just short of sector C.
  const bodyPoints = [
    new THREE.Vector2(-26.200000, 0.700000),
    new THREE.Vector2(11.000000, 0.700000),
    new THREE.Vector2(11.000000, 4.700000),
    new THREE.Vector2(-25.000000, 4.700000),
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

  // Brown's bracing: a radial strut from the beam's lower corner to the foot
  // of the sector, a diagonal brace back under the beam, and a short strut
  // from the sector's upper end down to the beam top.
  const spokeEnds = [
    new THREE.Vector2(-27.60, -7.60),
    new THREE.Vector2(-27.60, -7.60),
    new THREE.Vector2(-27.10, 7.40),
  ].map((point) => point.multiplyScalar(sourceScale));
  const spokeStarts = [
    new THREE.Vector2(-26.00, 1.10),
    new THREE.Vector2(-14.00, 0.90),
    new THREE.Vector2(-24.80, 4.40),
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
  // Brown's chain lies on the arc's rim, so the shoe's face runs forward
  // through the chain's plane and the links bear on it, just clear.
  const chainShoeBackZ = 0.30;
  const chainShoeFrontZ = geometry.chainOuterHigh + 0.025;
  const chainShoe = new THREE.Mesh(
    centeredExtrusion(annularSectorShape(
      14 * sourceScale,
      15.95 * sourceScale,
      shoeStart,
      shoeEnd,
    ), chainShoeFrontZ - chainShoeBackZ, 0.005),
    beamMaterial,
  );
  chainShoe.position.z = (chainShoeBackZ + chainShoeFrontZ) / 2;
  chainShoe.userData.guideRadius = chainGuideRadius;
  chainShoe.userData.role =
    'curved-chain-suspension-shoe-concentric-with-pivot-F';
  beam.add(chainShoe);

  const gudgeonStrap = new THREE.Mesh(plate(clip.union(
    poly([[-0.40, 0.90], [0.40, 0.90], [0.40, 5.30], [-0.40, 5.30]]
      .map(([x, y]) => [x * sourceScale, y * sourceScale])),
    poly([[-0.90, 5.30], [0.90, 5.30], [0.90, 5.80], [-0.90, 5.80]]
      .map(([x, y]) => [x * sourceScale, y * sourceScale])),
  ), beamPlaneZ + 0.125, beamPlaneZ + 0.17), beamMaterial);
  gudgeonStrap.userData.role = 'gudgeon-strap-and-nut-over-F-on-beam-D';
  beam.add(gudgeonStrap);
  const pivotBoreRadius = geometry.pivotShaftRadius + 0.012;
  const pivotBoss = new THREE.Mesh(plate(clip.difference(
    poly(circle([0, 0], 0.70 * sourceScale, 64)),
    poly(circle([0, 0], pivotBoreRadius, 64)),
  ), beamPlaneZ - 0.17, beamPlaneZ + 0.17), beamMaterial);
  pivotBoss.userData.bores = [{ x: 0, y: 0, radius: pivotBoreRadius }];
  pivotBoss.userData.role = 'beam-D-working-pivot-boss-at-F';
  const pivotBore = pivotBoss;

  const chainAttachmentBoss = cylinderAlongZ(0.34 * sourceScale, 0.20,
    beamMaterial, 34);
  chainAttachmentBoss.position.set(
    chainAttachment.x,
    chainAttachment.y,
    0.42,
  );
  chainAttachmentBoss.userData.role = 'chain-attachment-boss-on-beam-D';
  const chainAttachmentPin = cylinderAlongZ(geometry.chainPinRadius,
    geometry.chainOuterHigh - 0.33, darkMaterial, 22);
  chainAttachmentPin.position.set(chainAttachment.x, chainAttachment.y,
    (geometry.chainOuterHigh + 0.33) / 2);
  chainAttachmentPin.userData.role = 'chain-end-pin-on-beam-D';
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
    chainAttachmentBoss,
    chainAttachmentPin,
    chainAttachmentAnchor,
  );

  return {
    beam,
    body,
    chainAttachmentAnchor,
    chainAttachmentBoss,
    chainAttachmentPin,
    chainShoe,
    pivotBore,
    pivotBoss,
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
  // The solid back ends at the tooth root line, clear of the sector tips.
  const bodyRight = 0;
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
  const toothGeometry = centeredExtrusion(toothShape, 0.24, 0);
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
  const backWearStrip = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.045,
      bodyTop - toothedBottom,
      0.255,
    ),
    darkMaterial,
  );
  backWearStrip.position.set(
    bodyLeft + 0.0225,
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
    backWearStrip,
    originAnchor,
    backLineAnchor,
  );
  return {
    backLineAnchor,
    backWearStrip,
    body,
    originAnchor,
    rack,
    rackTeeth,
    topCap,
  };
}

// Links alternate as in a plate chain: inner links carry one central bored
// plate, outer links straddle them with two side plates and own both pins.
function makeFlexibleChainLink({
  chainMaterial,
  darkMaterial,
  geometry,
  nominalPitch,
  outer,
  width,
}) {
  const { chainInnerHalfDepth, chainLineZ, chainOuterHigh, chainOuterLow,
    chainPinRadius } = geometry;
  const link = new THREE.Group();
  link.userData.flexibleChainElement = true;
  link.userData.nominalArcPitch = nominalPitch;
  link.userData.outerLink = outer;
  link.userData.role = 'articulated-link-of-D-suspension-chain';
  const eyeRadius = width * 0.47;
  const boreRadius = chainPinRadius + 0.008;
  const outline = clip.union(
    poly([[0, -width * 0.27], [nominalPitch, -width * 0.27],
      [nominalPitch, width * 0.27], [0, width * 0.27]]),
    poly(circle([0, 0], eyeRadius, 48)),
    poly(circle([nominalPitch, 0], eyeRadius, 48)),
  );
  const bored = clip.difference(outline,
    poly(circle([0, 0], boreRadius, 48)),
    poly(circle([nominalPitch, 0], boreRadius, 48)));
  const plateSpans = outer
    ? [[chainOuterLow, chainOuterLow + 0.04], [chainOuterHigh - 0.04, chainOuterHigh]]
    : [[chainLineZ - chainInnerHalfDepth, chainLineZ + chainInnerHalfDepth]];
  const plates = plateSpans.map(([low, high]) => {
    const mesh = new THREE.Mesh(plate(outer ? outline : bored, low, high),
      chainMaterial);
    mesh.position.x = -nominalPitch / 2;
    if (!outer) {
      mesh.userData.bores = [
        { x: 0, y: 0, radius: boreRadius },
        { x: nominalPitch, y: 0, radius: boreRadius },
      ];
    }
    mesh.userData.role = outer
      ? 'chain-outer-side-plate'
      : 'chain-inner-bored-plate';
    return mesh;
  });
  const body = new THREE.Group();
  body.position.x = nominalPitch / 2;
  body.userData.role = 'chain-side-plate-between-adjacent-pins';
  body.add(...plates);
  const pins = outer ? [0, nominalPitch].map((x) => {
    const pin = cylinderAlongZ(chainPinRadius,
      chainOuterHigh - chainOuterLow, darkMaterial, 22);
    pin.position.set(x - nominalPitch / 2, 0,
      (chainOuterHigh + chainOuterLow) / 2);
    pin.userData.role = x === 0 ? 'chain-link-start-pin' : 'chain-link-end-pin';
    body.add(pin);
    return pin;
  }) : [null, null];
  const startAnchor = new THREE.Object3D();
  startAnchor.position.z = chainLineZ;
  startAnchor.userData.role = 'analytic-chain-link-start';
  const endAnchor = new THREE.Object3D();
  endAnchor.position.set(nominalPitch, 0, chainLineZ);
  endAnchor.userData.role = 'analytic-chain-link-end';
  link.add(body, startAnchor, endAnchor);
  return {
    body,
    endAnchor,
    endBoss: plates[0],
    endPin: pins[1],
    link,
    plates,
    startAnchor,
    startBoss: plates[0],
    startPin: pins[0],
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
    chainInnerHalfDepth: 0.045,
    chainLineZ: 0.58,
    chainOuterHigh: 0.675,
    chainOuterLow: 0.485,
    chainPinRadius: 0.16 * 0.94 * sourceScale,
    pivotShaftRadius: 0.30 * sourceScale,
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
  // Brown draws one timber bed behind the rack, sector and chain rod, a
  // half-round seat under F, and no guide rails.
  const bedTop = -1.15 * sourceScale;
  const bedBottom = -4.85 * sourceScale;
  const frameRails = [];
  const lowerBed = new THREE.Mesh(
    new THREE.BoxGeometry(frameLength, bedTop - bedBottom, 0.50),
    frameMaterial,
  );
  lowerBed.position.set(frameCenterX, (bedTop + bedBottom) / 2, -0.37);
  lowerBed.userData.fixed = true;
  lowerBed.userData.role = 'fixed-timber-bed-behind-rack-and-chain';
  fixedFrame.add(lowerBed);

  const pivotPedestal = new THREE.Group();
  pivotPedestal.position.set(0, 0, 0);
  pivotPedestal.userData.fixed = true;
  pivotPedestal.userData.role = 'fixed-pedestal-and-bearing-F';
  const pivotShaftLow = -0.47;
  const pivotShaftHigh = beamPlaneZ + 0.19;
  const pivotShaft = cylinderAlongZ(geometry.pivotShaftRadius,
    pivotShaftHigh - pivotShaftLow, darkMaterial, 38);
  pivotShaft.position.z = (pivotShaftLow + pivotShaftHigh) / 2;
  pivotShaft.userData.fixed = true;
  pivotShaft.userData.role = 'fixed-shaft-through-beam-pivot-F';
  const seatRadius = 1.6 * sourceScale;
  const pivotBearing = new THREE.Mesh(plate(clip.intersection(
    poly(circle([0, bedTop], seatRadius, 96)),
    poly([[-seatRadius, bedTop], [seatRadius, bedTop],
      [seatRadius, bedTop + seatRadius], [-seatRadius, bedTop + seatRadius]]),
  ), -0.45, -0.17), frameMaterial);
  pivotBearing.userData.fixed = true;
  pivotBearing.userData.role = 'fixed-half-round-seat-and-bearing-F';
  pivotPedestal.add(pivotShaft, pivotBearing);
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
  const rollerDisk = new THREE.Mesh(boredPlanarLinkGeometry({ length: 0, width: 0,
    eyeRadius: rollerRadius, boreRadius: 0.30 * rollerRadius + 0.004, depth: 0.36 }), chainMaterial);
  rollerDisk.position.z = 0.29;
  rollerDisk.userData.role = 'working-tread-of-backing-roller-A';
  const rollerHub = cylinderAlongZ(0.28 * rollerRadius, 0.38,
    darkMaterial, 32);
  rollerHub.position.z = 0.295;
  rollerHub.userData.role = 'hub-of-free-backing-roller-A';
  rollerA.add(rollerDisk);
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
  // Brown draws the rod below D as wide as the chain above it (its eye's
  // diameter), not a thin wire.
  const chainRodBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.90 * sourceScale, 12 * sourceScale,
      2 * geometry.chainInnerHalfDepth),
    chainMaterial,
  );
  chainRodBody.position.set(0, -6 * sourceScale, 0.58);
  chainRodBody.userData.role = 'straight-output-rod-below-chain-D';
  const chainRodTopBoss = new THREE.Mesh(plate(clip.difference(
    poly(circle([0, 0], 0.47 * sourceScale, 48)),
    poly(circle([0, 0], geometry.chainPinRadius + 0.008, 48)),
  ), -geometry.chainInnerHalfDepth, geometry.chainInnerHalfDepth), chainMaterial);
  chainRodTopBoss.userData.bores = [
    { x: 0, y: 0, radius: geometry.chainPinRadius + 0.008 },
  ];
  chainRodTopBoss.position.z = 0.58;
  chainRodTopBoss.userData.role = 'top-eye-of-chain-suspended-rod';
  const chainRodTopAnchor = new THREE.Object3D();
  chainRodTopAnchor.position.z = 0.58;
  chainRodTopAnchor.userData.role = 'analytic-top-of-chain-suspended-rod';
  chainRod.add(
    chainRodBody,
    chainRodTopBoss,
    chainRodTopAnchor,
  );
  root.add(chainRod);

  const chainLinks = Array.from({ length: chainLinkCount }, (_, index) => {
    const parts = makeFlexibleChainLink({
      chainMaterial,
      darkMaterial,
      geometry,
      nominalPitch: chainLinkPitch,
      outer: index % 2 === 0,
      width: 0.94 * sourceScale,
    });
    parts.link.userData.index = index;
    root.add(parts.link);
    return parts;
  });

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
    beamPivotBoss: beamParts.pivotBoss,
    chainLinks,
    chainRod,
    chainRodBody,
    chainRodTopAnchor,
    chainRodTopBoss,
    chainShoe: beamParts.chainShoe,
    fixedFrame,
    lowerBed,
    pitchContactAnchor,
    pivotFAnchor,
    pivotPedestal,
    pivotShaft,
    rack: rackParts.rack,
    rackBackLineAnchor: rackParts.backLineAnchor,
    rackBackWearStrip: rackParts.backWearStrip,
    rackBody: rackParts.body,
    rackOriginAnchor: rackParts.originAnchor,
    rackTeeth: rackParts.rackTeeth,
    rollerA,
    rollerContactAnchor,
    rollerDisk,
    rollerHub,
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
  root.userData.hideGround = true;
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  const sweptBounds = new THREE.Box3();
  for (let sample = 0; sample <= 64; sample += 1) {
    update(cyclePeriod * sample / 64);
    root.updateMatrixWorld(true);
    sweptBounds.union(new THREE.Box3().setFromObject(root));
  }
  // Brown's plate is a straight elevation cropped from roller A to just
  // past F, from the top of rack B to the lower ends of both rods.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-37.5 * sourceScale, -21.5 * sourceScale, -0.65),
    new THREE.Vector3(9.0 * sourceScale, 18.5 * sourceScale, 0.70),
  );
  root.userData.cameraDistanceScale = 0.96;
  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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
  // Official animation: B at 6, 3.5-unit drops, and a 6-unit radius bar
  // pivoted at F=(-12,-3.5) under A. Brown instead draws the classic Watt
  // motion: B at about 0.66 of O-A, 4-unit drops, and a long radius rod
  // (about 10.9 units) running left to F near the plate edge. The model uses
  // the plate's rod and drop lengths and places B where O, the Watt point on
  // B-Q and E stay collinear (|O-B|^2 = |F-Q| (|O-A| - |O-B|)), which keeps
  // E as straight as the official proportions.
  const officialBeamMiddleStationRadius = 6;
  const officialDropLinkLength = 3.5;
  const officialFixedRadiusPivotF = new THREE.Vector2(-12, -3.5);
  const officialFixedRadiusLength = 6;
  const officialCrossbarLength = 6;
  const sourceFixedRadiusLength = 10.9;
  const sourceBeamMiddleStationRadius = (
    -sourceFixedRadiusLength + Math.sqrt(sourceFixedRadiusLength ** 2
      + 4 * sourceFixedRadiusLength * sourceBeamLeftStationRadius)
  ) / 2;
  const sourceDropLinkLength = 4;
  const sourceFixedRadiusPivotF = new THREE.Vector2(
    -sourceBeamMiddleStationRadius - sourceFixedRadiusLength,
    -sourceDropLinkLength,
  );
  const sourceCrossbarLength = sourceBeamLeftStationRadius
    - sourceBeamMiddleStationRadius;
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
      new THREE.Vector2(-sourceBeamMiddleStationRadius, -sourceDropLinkLength)
        .multiplyScalar(sourceScale),
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

  // Brown draws the beam level, with pins A and B on the dashed centre line
  // through O. Model time 0 is that pose: the hidden crank pin is where the
  // drive rod reaches the level beam driver (12.375, 0). The official
  // animation's start falls at canonicalTimes.sourceStart.
  const plateCrankAngle = Math.asin((
    sourceHiddenCrankRadius ** 2 + sourceHiddenCrankPivot.y ** 2
      - sourceHiddenDriveRodLength ** 2
  ) / (2 * -sourceHiddenCrankPivot.y * sourceHiddenCrankRadius));
  const plateInputTravel = plateCrankAngle - sourceInputPhaseOffset;
  const plateTimeOffset = plateInputTravel / inputAngularSpeed;
  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time + plateInputTravel,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time + plateTimeOffset, cyclePeriod)
      / cyclePeriod;
    state.time = time;
    return state;
  };

  const sourceTime = (fraction) => positiveModulo(
    cyclePeriod * fraction - plateTimeOffset,
    cyclePeriod,
  );
  const canonicalTimes = {
    platePose: 0,
    sourceStart: sourceTime(0),
    sourceQuarter: sourceTime(1 / 4),
    sourceHalf: sourceTime(1 / 2),
    sourceThreeQuarter: sourceTime(3 / 4),
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
    plateInputTravel,
    plateTimeOffset,
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

  // Brown shows only the tapered beam with its large fulcrum boss and
  // sectioned shaft O, the pins, the drop links, the lower bars and a plain
  // piston rod. Planes run back to front so pin E never reaches the radius
  // bar or stub F that it passes over.
  const radiusPlaneZ = -0.12;
  const crossbarPlaneZ = 0.04;
  const pistonPlaneZ = 0.18;
  const dropPlaneZ = 0.34;
  const beamPlaneZ = 0.56;
  const barHalfDepth = 0.06;
  const beamHalfDepth = 0.12;
  const s = sourceScale;
  const pinClearance = 0.012;
  const pinRadius = { A: 0.13, B: 0.12, E: 0.12, Q: 0.12 };
  const fixedPinRadius = 0.11;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-beam-fulcrum-shaft-O-and-radius-pin-F';
  const pivotOShaftLow = beamPlaneZ - beamHalfDepth - 0.12;
  const pivotOShaftHigh = beamPlaneZ + beamHalfDepth + 0.02;
  const pivotOShaft = cylinderAlongZ(0.38 * s, pivotOShaftHigh - pivotOShaftLow,
    darkMaterial, 34);
  pivotOShaft.position.z = (pivotOShaftLow + pivotOShaftHigh) / 2;
  pivotOShaft.userData.fixed = true;
  pivotOShaft.userData.role = 'fixed-sectioned-shaft-through-beam-fulcrum-O';
  const pivotFShaftLow = radiusPlaneZ - barHalfDepth - 0.16;
  const pivotFShaftHigh = radiusPlaneZ + barHalfDepth + 0.015;
  const pivotFShaft = cylinderAlongZ(fixedPinRadius,
    pivotFShaftHigh - pivotFShaftLow, darkMaterial, 32);
  pivotFShaft.position.set(fixedRadiusPivotF.x, fixedRadiusPivotF.y,
    (pivotFShaftLow + pivotFShaftHigh) / 2);
  pivotFShaft.userData.fixed = true;
  pivotFShaft.userData.role = 'fixed-pin-at-radius-pivot-F';
  fixedFrame.add(pivotOShaft, pivotFShaft);
  root.add(fixedFrame);

  const beam = new THREE.Group();
  beam.userData.axis = Z_AXIS.clone();
  beam.userData.role = 'ternary-stationary-engine-beam-A-B-O';
  const beamBores = [
    { x: -beamLeftStationRadius, y: 0, radius: pinRadius.A + pinClearance },
    { x: -beamMiddleStationRadius, y: 0, radius: pinRadius.B + pinClearance },
    { x: 0, y: 0, radius: 0.38 * s + pinClearance },
  ];
  const beamOutline = clip.union(
    poly([
      [-12.041667, -0.62], [-0.125, -1.40], [3.1, -1.10],
      [3.1, 1.10], [0.125, 1.30], [-12.041667, 0.62],
    ].map(([x, y]) => [x * s, y * s])),
    poly(circle([-beamLeftStationRadius, 0], 0.78 * s, 64)),
    poly(circle([0, 0], 1.90 * s, 96)),
  );
  const beamBody = new THREE.Mesh(plate(clip.difference(beamOutline,
    ...beamBores.map((bore) => poly(circle([bore.x, bore.y], bore.radius, 64)))),
  beamPlaneZ - beamHalfDepth, beamPlaneZ + beamHalfDepth), beamMaterial);
  beamBody.userData.bores = beamBores;
  beamBody.userData.role = 'rigid-tapered-stationary-engine-beam-body';
  const leftBossOuter = beamBody;
  const leftBossInner = beamBody;
  const middleBoss = beamBody;
  const pivotBoss = beamBody;
  const pivotBore = beamBody;
  const pointAAnchor = new THREE.Object3D();
  pointAAnchor.position.set(-beamLeftStationRadius, 0, beamPlaneZ);
  pointAAnchor.userData.role = 'analytic-beam-left-station-A';
  const pointBAnchor = new THREE.Object3D();
  pointBAnchor.position.set(-beamMiddleStationRadius, 0, beamPlaneZ);
  pointBAnchor.userData.role = 'analytic-beam-middle-station-B';
  const pivotOAnchor = new THREE.Object3D();
  pivotOAnchor.position.z = beamPlaneZ;
  pivotOAnchor.userData.role = 'analytic-fixed-beam-pivot-O';
  beam.add(beamBody, pointAAnchor, pointBAnchor, pivotOAnchor);
  root.add(beam);

  const barWidth = 0.13;
  const leftDropParts = makePinnedRod({
    bodyMaterial: linkMaterial,
    boreRadius: pinRadius.E + pinClearance,
    depth: 2 * barHalfDepth,
    length: dropLinkLength,
    planeZ: dropPlaneZ,
    role: 'left-four-unit-link-A-E',
    startBoreRadius: pinRadius.A + pinClearance,
    width: barWidth,
  });
  const middleDropParts = makePinnedRod({
    bodyMaterial: linkMaterial,
    boreRadius: pinRadius.Q + pinClearance,
    depth: 2 * barHalfDepth,
    length: dropLinkLength,
    planeZ: dropPlaneZ,
    role: 'middle-four-unit-link-B-Q',
    startBoreRadius: pinRadius.B + pinClearance,
    width: barWidth,
  });
  const fixedRadiusParts = makePinnedRod({
    bodyMaterial: radiusMaterial,
    boreRadius: pinRadius.Q + pinClearance,
    depth: 2 * barHalfDepth,
    length: fixedRadiusLength,
    planeZ: radiusPlaneZ,
    role: 'long-fixed-radius-rod-F-Q',
    startBoreRadius: fixedPinRadius + pinClearance,
    width: barWidth,
  });
  const crossbarParts = makePinnedRod({
    bodyMaterial: beamMaterial,
    boreRadius: pinRadius.Q + pinClearance,
    depth: 2 * barHalfDepth,
    length: crossbarLength,
    planeZ: crossbarPlaneZ,
    role: 'parallel-bar-E-Q',
    startBoreRadius: pinRadius.E + pinClearance,
    width: barWidth,
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
  const pistonHalfWidth = 0.1875 * s;
  const pistonEyeRadius = pinRadius.E + pinClearance + 0.035;
  const pistonBore = pinRadius.E + pinClearance;
  const pistonRod = new THREE.Mesh(plate(clip.difference(
    clip.union(
      poly([[-pistonHalfWidth, -7.2 * s], [pistonHalfWidth, -7.2 * s],
        [pistonHalfWidth, 0], [-pistonHalfWidth, 0]]),
      poly(circle([0, 0], pistonEyeRadius, 64)),
    ),
    poly(circle([0, 0], pistonBore, 64)),
  ), pistonPlaneZ - barHalfDepth, pistonPlaneZ + barHalfDepth), outputMaterial);
  pistonRod.userData.bores = [{ x: 0, y: 0, radius: pistonBore }];
  pistonRod.userData.role = 'straight-piston-rod-below-E';
  const pointEAnchor = new THREE.Object3D();
  pointEAnchor.position.z = pistonPlaneZ;
  pointEAnchor.userData.role = 'analytic-piston-point-E';
  piston.add(pistonRod, pointEAnchor);
  root.add(piston);

  const pinOn = (parent, name, x, low, high) => {
    const pin = cylinderAlongZ(pinRadius[name], high - low, whiteMaterial, 30);
    pin.position.set(x, 0, (low + high) / 2);
    pin.userData.role = `common-working-pin-${name}`;
    parent.add(pin);
    return pin;
  };
  const jointPins = {
    A: pinOn(beam, 'A', -beamLeftStationRadius, dropPlaneZ - barHalfDepth - 0.02,
      beamPlaneZ + beamHalfDepth + 0.02),
    B: pinOn(beam, 'B', -beamMiddleStationRadius, dropPlaneZ - barHalfDepth - 0.02,
      beamPlaneZ + beamHalfDepth + 0.02),
    E: pinOn(leftDropParts.rod, 'E', dropLinkLength,
      crossbarPlaneZ - barHalfDepth - 0.02, dropPlaneZ + barHalfDepth + 0.02),
    Q: pinOn(middleDropParts.rod, 'Q', dropLinkLength,
      radiusPlaneZ - barHalfDepth - 0.02, dropPlaneZ + barHalfDepth + 0.02),
  };
  const pinZ = (name) => jointPins[name].position.z;

  const setRodPose = (rod, start, rates) => {
    rod.position.set(start.x, start.y, 0);
    rod.rotation.z = rates.angle;
  };
  const contacts = {
    beamPivotO: {
      fixedMember: fixedFrame,
      movingMember: beam,
      point: new THREE.Vector3(0, 0, beamPlaneZ),
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
        radiusPlaneZ,
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
    contacts.leftDropAtA.point.set(state.pointA.x, state.pointA.y, pinZ('A'));
    contacts.middleDropAtB.point.set(state.pointB.x, state.pointB.y, pinZ('B'));
    contacts.crossbarAtE.point.set(state.pointE.x, state.pointE.y, pinZ('E'));
    contacts.fourMembersAtQ.point.set(state.pointQ.x, state.pointQ.y, pinZ('Q'));
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
    crossbar: crossbarParts.rod,
    crossbarEndAnchor: crossbarParts.endAnchor,
    crossbarStartAnchor: crossbarParts.startAnchor,
    fixedFrame,
    fixedRadiusBar: fixedRadiusParts.rod,
    fixedRadiusEndAnchor: fixedRadiusParts.endAnchor,
    fixedRadiusStartAnchor: fixedRadiusParts.startAnchor,
    jointPins,
    leftDropLink: leftDropParts.rod,
    leftDropLinkEndAnchor: leftDropParts.endAnchor,
    leftDropLinkStartAnchor: leftDropParts.startAnchor,
    middleDropLink: middleDropParts.rod,
    middleDropLinkEndAnchor: middleDropParts.endAnchor,
    middleDropLinkStartAnchor: middleDropParts.startAnchor,
    piston,
    pistonPointAnchor: pointEAnchor,
    pistonRod,
    pivotOShaft,
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
      beamMiddleStationRadius: officialBeamMiddleStationRadius,
      beamPivotO: sourceBeamPivotO,
      crossbarLength: officialCrossbarLength,
      dropLinkLength: officialDropLinkLength,
      fixedRadiusLength: officialFixedRadiusLength,
      fixedRadiusPivotF: officialFixedRadiusPivotF,
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
      'official hidden crank and rod, beam station A, source branches, view, and 15 rpm timing; B, drops, F and the lower bars follow the plate',
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
      plateProportions:
        'with |O-A|=12: B at 7.97, drops 4.03, radius rod 10.9 from F at (-18.8, -3.9); the model keeps the rod (10.9) and drops (4) and sets B at 7.22 so E stays on its straight line',
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
      '|O-A|=12, |O-B|=7.22, |A-E|=|B-Q|=4, |F-Q|=10.9, and |E-Q|=|O-A|-|O-B| source units (plate proportions; official 6, 3.5, 6, 6)',
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
  root.userData.hideGround = true;
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  const sweptBounds = new THREE.Box3();
  for (let sample = 0; sample <= 64; sample += 1) {
    update(cyclePeriod * sample / 64);
    root.updateMatrixWorld(true);
    sweptBounds.union(new THREE.Box3().setFromObject(root));
  }
  // Frame Brown's crop: the beam cut just past the fulcrum boss O on the
  // right, and the piston rod running off the foot of the plate.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-19.8 * sourceScale, -11.7 * sourceScale, -0.40),
    new THREE.Vector3(2.4 * sourceScale, 10.4 * sourceScale, 0.72),
  );
  root.userData.cameraDistanceScale = 0.96;
  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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
