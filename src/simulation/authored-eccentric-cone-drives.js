import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';
import {plate, poly, polygonClipping} from './finite-plate-geometry.js';
import {helicalThread, threadAngles} from './mujoco-screw/thread-geometry.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedAngle(unwrappedAngle) {
  const turns = unwrappedAngle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-12) return 0;
  return positiveModulo(unwrappedAngle, FULL_TURN);
}

function cylinderAlongX(radius, length, material, segments = 52) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function annularCollarAlongX({
  depth,
  innerRadius,
  material,
  outerRadius,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 56,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  const collar = new THREE.Mesh(geometry, material);
  collar.rotation.y = Math.PI / 2;
  return collar;
}

class UnitVerticalSpringCurve extends THREE.Curve {
  constructor({ coilCount, radius }) {
    super();
    this.coilCount = coilCount;
    this.radius = radius;
  }

  getPoint(progress, target = new THREE.Vector3()) {
    const angle = FULL_TURN * this.coilCount * progress;
    return target.set(
      this.radius * Math.cos(angle),
      progress,
      this.radius * Math.sin(angle),
    );
  }
}

const GAUSS_NODES = [
  -0.906179845938664,
  -0.5384693101056831,
  0,
  0.5384693101056831,
  0.906179845938664,
];
const GAUSS_WEIGHTS = [
  0.2369268850561891,
  0.4786286704993665,
  0.5688888888888889,
  0.4786286704993665,
  0.2369268850561891,
];

// Closed solid whose rectangular section flares from a neck to a foot, so the
// same pedestal reads as Brown's footed cradle in end view (262) and as the
// flared standard E in side view (263).
function flaredPedestalGeometry({
  bottomY,
  footHalfX,
  footHalfZ,
  footTopY,
  neckHalfX,
  neckHalfZ,
  neckBottomY,
  topY,
  flankSteps = 14,
}) {
  const levels = [[bottomY, footHalfX, footHalfZ], [footTopY, footHalfX, footHalfZ]];
  for (let step = 1; step <= flankSteps; step += 1) {
    const t = step / flankSteps;
    const flare = (1 - t) ** 2;
    levels.push([
      footTopY + (neckBottomY - footTopY) * t,
      neckHalfX + (footHalfX - neckHalfX) * flare,
      neckHalfZ + (footHalfZ - neckHalfZ) * flare,
    ]);
  }
  levels.push([topY, neckHalfX, neckHalfZ]);
  const corners = ([y, hx, hz]) => [
    [-hx, y, -hz], [hx, y, -hz], [hx, y, hz], [-hx, y, hz],
  ];
  const positions = [];
  const quad = (a, b, c, d) => positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let index = 0; index < levels.length - 1; index += 1) {
    const lower = corners(levels[index]);
    const upper = corners(levels[index + 1]);
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      quad(lower[side], lower[next], upper[next], upper[side]);
    }
  }
  const bottom = corners(levels[0]);
  const top = corners(levels[levels.length - 1]);
  quad(bottom[0], bottom[3], bottom[2], bottom[1]);
  quad(top[0], top[1], top[2], top[3]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',
    new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Brown's end-view standard E: a foot plate, a slim central neck and two
// splayed cove legs, outlined in the view plane (z across, y up) and given
// a shallow depth along the screw axis (x).
function splayedLegStandGeometry({
  bottomY, footTopY, footHalfZ, neckHalfZ, legTopZ, legTopY, legWidth,
  topY, halfDepth,
}) {
  const coveA = footHalfZ - legTopZ;
  const coveB = legTopY - footTopY;
  const shapes = [
    poly([[-footHalfZ, bottomY], [footHalfZ, bottomY], [footHalfZ, footTopY], [-footHalfZ, footTopY]]),
    poly([[-neckHalfZ, footTopY - 0.01], [neckHalfZ, footTopY - 0.01], [neckHalfZ, topY], [-neckHalfZ, topY]]),
  ];
  for (const side of [-1, 1]) {
    const outer = [];
    const inner = [];
    for (let i = 0; i <= 24; i += 1) {
      const phi = Math.PI / 2 * i / 24;
      outer.push([side * (footHalfZ - coveA * Math.sin(phi)),
        legTopY - coveB * Math.cos(phi)]);
      inner.push([side * (footHalfZ - (coveA + legWidth) * Math.sin(phi)),
        legTopY - (coveB + legWidth) * Math.cos(phi)]);
    }
    // The leg tops end behind B at every pose (within B's radius of every
    // position of its centre), so no loop closes round an open window.
    shapes.push(poly([...outer, [side * (legTopZ - legWidth), legTopY],
      ...inner.reverse()]));
  }
  const outline = polygonClipping.union(...shapes);
  const geometry = plate(outline, -halfDepth, halfDepth);
  // Outline x -> world z, extrusion -> world x.
  geometry.rotateY(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function integrateFivePoint(integrand, start, end) {
  if (start === end) return 0;
  const midpoint = (start + end) / 2;
  const halfWidth = (end - start) / 2;
  let sum = 0;
  for (let index = 0; index < GAUSS_NODES.length; index += 1) {
    sum += GAUSS_WEIGHTS[index] * integrand(
      midpoint + halfWidth * GAUSS_NODES[index],
    );
  }
  return halfWidth * sum;
}

function makeIntegralLookup(integrand, maximumAngle, intervalCount = 6144) {
  const intervalWidth = maximumAngle / intervalCount;
  const cumulative = new Float64Array(intervalCount + 1);
  for (let index = 0; index < intervalCount; index += 1) {
    const start = index * intervalWidth;
    const end = start + intervalWidth;
    cumulative[index + 1] = cumulative[index]
      + integrateFivePoint(integrand, start, end);
  }
  return (angle) => {
    const boundedAngle = THREE.MathUtils.clamp(angle, 0, maximumAngle);
    if (boundedAngle === maximumAngle) return cumulative[intervalCount];
    const index = Math.min(
      intervalCount - 1,
      Math.floor(boundedAngle / intervalWidth),
    );
    const start = index * intervalWidth;
    return cumulative[index]
      + integrateFivePoint(integrand, start, boundedAngle);
  };
}

function eccentricConeFrictionReverser(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.78);
  const presentationView = movement.id === 262 ? 'end-view' : 'side-view';

  const coneLength = 4.4;
  const coneLargeRadius = 1.2;
  const coneSmallRadius = 0.54;
  // Brown's end view puts screw D 13 of B's 55 raster pixels below B's
  // centre (0.24 of the large radius). That is well inside every section of
  // the cone, so roller C never reverses its spin; it rides up and down once
  // per turn, and because the contact spirals toward the small end each
  // descent is longer than the rise before it: the caption's reciprocation
  // with one stroke shorter than the other.
  const coneEccentricity = coneLargeRadius * 13 / 55;
  const rollerRadius = 0.36;
  const rollerWidth = 0.16;
  const screwLead = 0.19;
  const screwCoreRadius = 0.12;
  const screwThreadRadius = 0.17;
  const screwThreadTipRadius = .196;
  const screwThreadHand = -1;
  const screwThreadXStart = 2.38;
  const screwThreadXEnd = 6.28;
  const rightScrewCoreXStart = 2.24;
  const rightScrewCoreXEnd = 6.46;
  const leftInputJournalXStart = -3.24;
  const leftInputJournalXEnd = -2.2;
  const nutAxialPosition = 2.82;
  // Brown's side view sets roller C a quarter of the way from the large end.
  const initialContactAxialFraction = 0.25;
  const inputForwardTurns = 3;
  const maximumInputAngle = inputForwardTurns * FULL_TURN;
  const demonstrationPeriod = 12;
  const rollerContactAxialPosition = -coneLength / 2
    + initialContactAxialFraction * coneLength;
  const rollerAxialCenter = rollerContactAxialPosition + rollerWidth / 2;
  const radiusSlope = (
    coneSmallRadius - coneLargeRadius
  ) / coneLength;
  const radiusDerivativePerInputRadian = radiusSlope
    * screwLead / FULL_TURN;
  const translationDerivativePerInputRadian = -screwLead / FULL_TURN;

  const inputMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.54,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.52,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });
  const springMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.5,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.4 });

  const radiusAtLocalAxialPosition = (localAxialPosition) => (
    coneLargeRadius + radiusSlope * (localAxialPosition + coneLength / 2)
  );

  const contactScalarsAtInputAngle = (inputAngle) => {
    const screwTranslation = translationDerivativePerInputRadian
      * inputAngle;
    const localContactAxialPosition = rollerContactAxialPosition
      - screwTranslation;
    const contactAxialFraction = (
      localContactAxialPosition + coneLength / 2
    ) / coneLength;
    const coneRadiusAtContact = radiusAtLocalAxialPosition(
      localContactAxialPosition,
    );
    const centerY = coneEccentricity * Math.cos(inputAngle);
    const centerZ = coneEccentricity * Math.sin(inputAngle);
    const centerDistance = coneRadiusAtContact + rollerRadius;
    const verticalGapSquared = centerDistance ** 2 - centerZ ** 2;
    if (verticalGapSquared <= 0) {
      throw new RangeError('The spring-guided roller lost cone contact.');
    }
    const verticalGap = Math.sqrt(verticalGapSquared);
    const normalY = verticalGap / centerDistance;
    const normalZ = -centerZ / centerDistance;
    const contactNormalAngle = Math.atan2(normalZ, normalY);
    const contactNormalDerivativePerInputRadian = (
      -coneEccentricity * Math.cos(inputAngle)
        + coneEccentricity * Math.sin(inputAngle)
          * radiusDerivativePerInputRadian / centerDistance
    ) / verticalGap;
    const rollerAngularRatio = (
      centerDistance * contactNormalDerivativePerInputRadian
        - coneRadiusAtContact
    ) / rollerRadius;
    const rollerCenterY = centerY + verticalGap;
    const rollerCenterDerivativePerInputRadian =
      -coneEccentricity * Math.sin(inputAngle)
      + (
        centerDistance * radiusDerivativePerInputRadian
          - centerZ * coneEccentricity * Math.cos(inputAngle)
      ) / verticalGap;
    const coneCenterNormalProjection =
      centerY * normalY + centerZ * normalZ;
    const coneContactTangentSpeedPerInputRadian =
      coneCenterNormalProjection + coneRadiusAtContact;
    const rollerCenterTangentSpeedPerInputRadian =
      rollerCenterDerivativePerInputRadian * -normalZ;
    const circumferentialNoSlipResidual =
      rollerCenterTangentSpeedPerInputRadian
        - rollerAngularRatio * rollerRadius
        - coneContactTangentSpeedPerInputRadian;
    return {
      centerDistance,
      centerY,
      centerZ,
      circumferentialNoSlipResidual,
      coneContactTangentSpeedPerInputRadian,
      coneRadiusAtContact,
      contactAxialFraction,
      contactNormalAngle,
      contactNormalDerivativePerInputRadian,
      localContactAxialPosition,
      normalY,
      normalZ,
      rollerAngularRatio,
      rollerCenterDerivativePerInputRadian,
      rollerCenterTangentSpeedPerInputRadian,
      rollerCenterY,
      screwTranslation,
      verticalGap,
    };
  };

  const rollerAngularRatioAtInputAngle = (inputAngle) => (
    contactScalarsAtInputAngle(inputAngle).rollerAngularRatio
  );
  const rollerAngleAtInputAngle = makeIntegralLookup(
    rollerAngularRatioAtInputAngle,
    maximumInputAngle,
  );

  const configurationAtInputAngle = (inputAngle) => {
    if (inputAngle < -1e-12 || inputAngle > maximumInputAngle + 1e-12) {
      throw new RangeError(
        `Movement ${movement.id} input left its finite cone traverse.`,
      );
    }
    const boundedAngle = THREE.MathUtils.clamp(
      inputAngle,
      0,
      maximumInputAngle,
    );
    const scalars = contactScalarsAtInputAngle(boundedAngle);
    const coneAxisCenterAtContact = new THREE.Vector3(
      rollerContactAxialPosition,
      scalars.centerY,
      scalars.centerZ,
    );
    const contactNormal = new THREE.Vector3(
      0,
      scalars.normalY,
      scalars.normalZ,
    );
    const coneContactPoint = coneAxisCenterAtContact.clone().addScaledVector(
      contactNormal,
      scalars.coneRadiusAtContact,
    );
    const rollerCenter = new THREE.Vector3(
      rollerAxialCenter,
      scalars.rollerCenterY,
      0,
    );
    const rollerContactPoint = new THREE.Vector3(
      rollerContactAxialPosition,
      rollerCenter.y,
      rollerCenter.z,
    ).addScaledVector(contactNormal, -rollerRadius);
    const bodyContactAngle = scalars.contactNormalAngle - boundedAngle;
    const localConeContactPoint = new THREE.Vector3(
      scalars.localContactAxialPosition,
      coneEccentricity
        + scalars.coneRadiusAtContact * Math.cos(bodyContactAngle),
      scalars.coneRadiusAtContact * Math.sin(bodyContactAngle),
    );
    const transformedLocalContactPoint = localConeContactPoint.clone()
      .applyAxisAngle(X_AXIS, boundedAngle);
    transformedLocalContactPoint.x += scalars.screwTranslation;
    const rollerAngleUnwrapped = rollerAngleAtInputAngle(boundedAngle);
    const screwThreadPhaseAtNut = screwThreadHand * FULL_TURN * (
      nutAxialPosition
        - scalars.screwTranslation
        - screwThreadXStart
    ) / screwLead + boundedAngle;
    return {
      ...scalars,
      bodyContactAngle,
      coneAxisCenterAtContact,
      coneContactPoint,
      contactCoincidenceError: coneContactPoint.distanceTo(
        rollerContactPoint,
      ),
      contactNormal,
      localConeContactPoint,
      rollerAngle: wrappedAngle(rollerAngleUnwrapped),
      rollerAngleUnwrapped,
      rollerCenter,
      rollerContactPoint,
      screwThreadPhaseAtNut,
      transformedContactError: transformedLocalContactPoint.distanceTo(
        coneContactPoint,
      ),
      transformedLocalContactPoint,
    };
  };

  // Reversals of roller C's reciprocating (spring-loaded vertical) travel.
  const rollerVerticalRateAtInputAngle = (inputAngle) => (
    contactScalarsAtInputAngle(inputAngle).rollerCenterDerivativePerInputRadian
  );
  const rollerHeightAtInputAngle = (inputAngle) => (
    contactScalarsAtInputAngle(inputAngle).rollerCenterY
  );
  const directionChangeAngles = [];
  const rootScanCount = 12288;
  let previousAngle = 0;
  let previousRatio = rollerVerticalRateAtInputAngle(0);
  for (let sample = 1; sample <= rootScanCount; sample += 1) {
    const inputAngle = maximumInputAngle * sample / rootScanCount;
    const ratio = rollerVerticalRateAtInputAngle(inputAngle);
    if (ratio * previousRatio < 0) {
      let lower = previousAngle;
      let upper = inputAngle;
      let lowerRatio = previousRatio;
      for (let iteration = 0; iteration < 60; iteration += 1) {
        const midpoint = (lower + upper) / 2;
        const midpointRatio = rollerVerticalRateAtInputAngle(midpoint);
        if (midpointRatio * lowerRatio <= 0) upper = midpoint;
        else {
          lower = midpoint;
          lowerRatio = midpointRatio;
        }
      }
      directionChangeAngles.push((lower + upper) / 2);
    }
    previousAngle = inputAngle;
    previousRatio = ratio;
  }
  const directionIntervals = [];
  let shorterDirectionTravel = 0;
  let longerDirectionTravel = 0;
  const intervalBounds = [
    0,
    ...directionChangeAngles,
    maximumInputAngle,
  ];
  for (let index = 0; index < intervalBounds.length - 1; index += 1) {
    const start = intervalBounds[index];
    const end = intervalBounds[index + 1];
    const midpoint = (start + end) / 2;
    const signedTravel = rollerHeightAtInputAngle(end)
      - rollerHeightAtInputAngle(start);
    const direction = Math.sign(
      rollerVerticalRateAtInputAngle(midpoint),
    );
    directionIntervals.push({ direction, end, signedTravel, start });
    if (direction > 0) shorterDirectionTravel += signedTravel;
    else longerDirectionTravel -= signedTravel;
  }
  let minimumRollerAngularRatio = Infinity;
  let maximumRollerAngularRatio = -Infinity;
  for (let sample = 0; sample <= 1536; sample += 1) {
    const ratio = rollerAngularRatioAtInputAngle(
      maximumInputAngle * sample / 1536,
    );
    minimumRollerAngularRatio = Math.min(minimumRollerAngularRatio, ratio);
    maximumRollerAngularRatio = Math.max(maximumRollerAngularRatio, ratio);
  }

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-nut-E-base-and-spring-loaded-roller-guide';
  root.add(frame);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(9.25, 0.18, 1.2),
    frameMaterial,
  );
  base.position.set(1.1, -2.04, 0);
  base.userData.role = 'fixed-machine-base';
  frame.add(base);
  const nutPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.72, 0.40),
    frameMaterial,
  );
  nutPost.position.set(nutAxialPosition, -1.17, 0);
  nutPost.userData.role = 'fixed-standard-carrying-nut-E';
  frame.add(nutPost);
  const nut = annularCollarAlongX({
    depth: 0.28,
    innerRadius: .202,
    material: springMaterial,
    outerRadius: 0.31,
  });
  nut.position.set(nutAxialPosition, 0, 0);
  nut.userData.axiallyFixed = true;
  nut.userData.role = 'fixed-threaded-nut-E';
  frame.add(nut);

  // Keep the inferred spring guide beyond the translating cone's small end.
  const guideX = 2.50;
  const guideRails = [-.5, .5].map((z, index) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, 4.38, 32), frameMaterial);
    rail.position.set(guideX, .15, z);
    rail.userData.role = `roller-vertical-guide-${index}`;
    frame.add(rail); return rail;
  });
  const guideTop = new THREE.Mesh(new THREE.BoxGeometry(.24, .12, 1.20), frameMaterial);
  guideTop.position.set(guideX, 2.40, 0);
  guideTop.userData.role = 'fixed-spring-abutment-over-roller-C';
  frame.add(guideTop);

  const screwConeAssembly = new THREE.Group();
  screwConeAssembly.userData.axis = X_AXIS.clone();
  screwConeAssembly.userData.role =
    'rigid-rotating-and-translating-screw-D-with-eccentric-cone-B';
  root.add(screwConeAssembly);
  const screwCore = new THREE.Group();
  screwCore.userData.role =
    'end-supported-screw-D-core-leaving-cone-working-span-clear';
  const leftInputJournal = cylinderAlongX(
    screwCoreRadius,
    leftInputJournalXEnd - leftInputJournalXStart,
    darkMaterial,
    42,
  );
  leftInputJournal.position.x = (
    leftInputJournalXStart + leftInputJournalXEnd
  ) / 2;
  leftInputJournal.userData.role = 'left-input-journal-of-screw-D';
  const rightScrewCore = cylinderAlongX(
    screwCoreRadius,
    rightScrewCoreXEnd - rightScrewCoreXStart,
    darkMaterial,
    42,
  );
  rightScrewCore.position.x = (
    rightScrewCoreXStart + rightScrewCoreXEnd
  ) / 2;
  rightScrewCore.userData.role =
    'right-core-of-screw-D-through-fixed-nut-E';
  screwCore.add(leftInputJournal, rightScrewCore);
  const threadParameters = {inner: screwCoreRadius, outer: screwThreadTipRadius,
    low: screwThreadXStart, high: screwThreadXEnd, lead: -screwLead / FULL_TURN,
    phase: screwThreadXStart, width: .085};
  const screwThread = new THREE.Mesh(helicalThread(threadParameters,
    threadAngles(threadParameters, 64)).rotateY(Math.PI / 2), darkMaterial);
  const nutParameters = {...threadParameters, inner: .124, outer: .204,
    low: -.14, high: .14, phase: screwThreadXStart - nutAxialPosition + screwLead / 2};
  const nutThread = new THREE.Mesh(helicalThread(nutParameters,
    threadAngles(nutParameters, 64)).rotateY(Math.PI / 2), springMaterial);
  nutThread.position.x = nutAxialPosition;
  nutThread.userData.role = 'stationary-mating-solid-thread-in-nut-E';
  frame.add(nutThread);
  screwThread.userData.hand = screwThreadHand;
  screwThread.userData.lead = screwLead;
  screwThread.userData.role = 'single-start-helical-thread-on-screw-D';

  const coneBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      coneLargeRadius,
      coneSmallRadius,
      coneLength,
      96,
      1,
      false,
    ),
    inputMaterial,
  );
  coneBody.rotation.z = Math.PI / 2;
  coneBody.position.y = coneEccentricity;
  coneBody.userData.axisOffsetFromScrew = coneEccentricity;
  coneBody.userData.radiusAtLocalAxialPosition =
    radiusAtLocalAxialPosition;
  coneBody.userData.role = 'eccentric-conical-friction-body-B';
  const coneGeneratorIndex = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(
        new THREE.Vector3(
          -coneLength / 2,
          coneEccentricity + coneLargeRadius + 0.018,
          0,
        ),
        new THREE.Vector3(
          coneLength / 2,
          coneEccentricity + coneSmallRadius + 0.018,
          0,
        ),
      ),
      96,
      0.026,
      7,
      false,
    ),
    whiteMaterial,
  );
  coneGeneratorIndex.userData.role =
    'white-rigid-generator-index-on-cone-B';
  const eccentricConnectors = [-1, 1].map((side) => {
    const connector = makeDynamicLink({
      color: PALETTE.driver,
      depth: 0.1,
      jointRadius: 0.08,
      thickness: 0.1,
    });
    const x = side * (coneLength / 2 + 0.035);
    connector.userData.setEndpoints(
      new THREE.Vector3(x, 0, 0),
      new THREE.Vector3(x, coneEccentricity, 0),
    );
    connector.userData.role =
      `${side < 0 ? 'large' : 'small'}-end-eccentric-cone-carrier`;
    return connector;
  });
  screwConeAssembly.add(
    screwCore,
    screwThread,
    coneBody,
    coneGeneratorIndex,
    ...eccentricConnectors,
  );

  const rollerCarriage = new THREE.Group();
  rollerCarriage.position.set(rollerAxialCenter, 0, 0);
  rollerCarriage.userData.guideAxis = new THREE.Vector3(0, 1, 0);
  rollerCarriage.userData.role =
    'spring-loaded-vertical-carriage-for-friction-roller-C';
  root.add(rollerCarriage);
  const rollerRotor = new THREE.Group();
  rollerRotor.userData.axis = X_AXIS.clone();
  rollerRotor.userData.role = 'freely-rolling-friction-roller-C-rotor';
  rollerCarriage.add(rollerRotor);
  const rollerBody = cylinderAlongX(
    rollerRadius,
    rollerWidth,
    drivenMaterial,
    68,
  );
  rollerBody.geometry.dispose();
  rollerBody.geometry = boredCylinderGeometry(rollerRadius, .069, rollerWidth);
  rollerBody.userData.contactEdgeLocalX = -rollerWidth / 2;
  rollerBody.userData.role =
    'thin-roller-C-touching-cone-at-large-end-side-edge';
  const rollerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, rollerRadius * 0.72, 0.038),
    whiteMaterial,
  );
  rollerIndex.position.set(
    rollerWidth / 2 + 0.035,
    rollerRadius * 0.34,
    0,
  );
  rollerIndex.userData.role =
    'white-index-showing-variable-and-reversing-roller-C-spin';
  rollerRotor.add(rollerBody, rollerIndex);
  const rollerAxle = cylinderAlongX(
    0.065,
    guideX - rollerAxialCenter + .30,
    darkMaterial,
    30,
  );
  rollerAxle.position.x = (guideX - rollerAxialCenter) / 2;
  rollerAxle.userData.role = 'guided-axis-of-friction-roller-C';
  rollerCarriage.add(rollerAxle);
  const carriageBlocks = [-.5, .5].map((z, index) => {
    const block = new THREE.Mesh(boredCylinderGeometry(.13, .059, .20), frameMaterial);
    block.position.set(guideX - rollerAxialCenter, 0, z);
    block.userData.role = `bored-roller-slide-${index}`;
    rollerCarriage.add(block); return block;
  });
  const carriageBridge = new THREE.Mesh(new THREE.BoxGeometry(.12, .10, .76), frameMaterial);
  carriageBridge.position.x = guideX - rollerAxialCenter;
  carriageBridge.userData.role = 'rigid-bridge-joining-roller-axle-to-guided-spring-seat';
  rollerCarriage.add(carriageBridge);

  const springCurve = new UnitVerticalSpringCurve({
    coilCount: 8,
    radius: 0.085,
  });
  const contactSpring = new THREE.Mesh(
    new THREE.TubeGeometry(springCurve, 128, 0.024, 7, false),
    springMaterial,
  );
  contactSpring.userData.role =
    'source-permitted-spring-pressing-roller-C-against-cone-B';
  contactSpring.userData.setEndpoints = (lowerY, upperY) => {
    const length = Math.max(upperY - lowerY, 0.08);
    contactSpring.position.set(guideX, lowerY, .5);
    contactSpring.scale.set(1, length, 1);
  };
  root.add(contactSpring);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 20, 14),
    whiteMaterial,
  );
  contactMarker.userData.role =
    'moving-exact-edge-contact-between-cone-B-and-roller-C';
  root.add(contactMarker);

  const stateAtTime = (time) => {
    const wrappedTime = positiveModulo(time, demonstrationPeriod);
    const phase = FULL_TURN * wrappedTime / demonstrationPeriod;
    // Uniform source drive for most of each stroke; short cosine ramps
    // make the finite demonstrator's explicitly inferred return continuous.
    const halfPeriod = demonstrationPeriod / 2, ramp = .4;
    const returning = wrappedTime > halfPeriod;
    const strokeTime = returning ? demonstrationPeriod - wrappedTime : wrappedTime;
    const speed = maximumInputAngle / (halfPeriod - ramp);
    let inputAngleUnwrapped, velocity, acceleration;
    if (strokeTime < ramp) {
      const a = Math.PI * strokeTime / ramp;
      inputAngleUnwrapped = speed * (strokeTime - ramp * Math.sin(a) / Math.PI) / 2;
      velocity = speed * (1 - Math.cos(a)) / 2;
      acceleration = speed * Math.PI * Math.sin(a) / (2 * ramp);
    } else if (strokeTime > halfPeriod - ramp) {
      const t = halfPeriod - strokeTime, a = Math.PI * t / ramp;
      inputAngleUnwrapped = maximumInputAngle - speed * (t - ramp * Math.sin(a) / Math.PI) / 2;
      velocity = speed * (1 - Math.cos(a)) / 2;
      acceleration = -speed * Math.PI * Math.sin(a) / (2 * ramp);
    } else {
      inputAngleUnwrapped = speed * (strokeTime - ramp / 2);
      velocity = speed; acceleration = 0;
    }
    const inputAngularSpeed = returning ? -velocity : velocity;
    const inputAngularAcceleration = acceleration;
    const configuration = configurationAtInputAngle(inputAngleUnwrapped);
    const derivativeStep = 1e-5;
    const lowerAngle = Math.max(0, inputAngleUnwrapped - derivativeStep);
    const upperAngle = Math.min(
      maximumInputAngle,
      inputAngleUnwrapped + derivativeStep,
    );
    const ratioDerivativePerInputRadian = upperAngle === lowerAngle
      ? 0
      : (
        rollerAngularRatioAtInputAngle(upperAngle)
          - rollerAngularRatioAtInputAngle(lowerAngle)
      ) / (upperAngle - lowerAngle);
    return {
      configuration,
      contactPoint: configuration.coneContactPoint.clone(),
      inputAngle: wrappedAngle(inputAngleUnwrapped),
      inputAngleUnwrapped,
      inputAngularAcceleration,
      inputAngularSpeed,
      phase,
      rollerAngle: configuration.rollerAngle,
      rollerAngleUnwrapped: configuration.rollerAngleUnwrapped,
      rollerAngularAcceleration:
        ratioDerivativePerInputRadian * inputAngularSpeed ** 2
          + configuration.rollerAngularRatio * inputAngularAcceleration,
      rollerAngularRatio: configuration.rollerAngularRatio,
      rollerAngularSpeed:
        configuration.rollerAngularRatio * inputAngularSpeed,
      rollerCenter: configuration.rollerCenter.clone(),
      rollerVerticalSpeed:
        configuration.rollerCenterDerivativePerInputRadian
          * inputAngularSpeed,
      screwTranslation: configuration.screwTranslation,
      screwTranslationSpeed:
        translationDerivativePerInputRadian * inputAngularSpeed,
      wrappedTime,
    };
  };

  root.userData.archetype =
    'fixed-nut-screw-translated-eccentric-cone-edge-contact-friction-roller-reverser';
  root.userData.blocks = {
    base,
    carriageBlocks,
    carriageBridge,
    nutThread,
    coneBody,
    coneGeneratorIndex,
    contactMarker,
    contactSpring,
    eccentricConnectors,
    frame,
    guideRails,
    guideTop,
    leftInputJournal,
    nut,
    nutPost,
    rollerAxle,
    rollerBody,
    rollerCarriage,
    rollerIndex,
    rollerRotor,
    screwConeAssembly,
    screwCore,
    screwThread,
    rightScrewCore,
  };
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.25, -1.9, -1.85),
    new THREE.Vector3(6.25, 2.85, 1.85),
  );
  root.userData.contactDefinition = {
    axialContact:
      'large-end-side-edge-of-thin-roller-C-at-one-fixed-world-axial-plane',
    circumferentialRolling: 'ideal-no-slip',
    coneAxialSliding:
      'screw translation produces the source-described spiral trace',
    contactLoadChoice: 'spring',
    sourcePermits: 'spring-or-weight',
  };
  root.userData.driveSchedule = {
    demonstration:
      'three-turn-uniform-forward-traverse-with-short-end-ramps-and-exact-reverse-return',
    demonstrationBeginsAtAxialFraction: initialContactAxialFraction,
    purpose:
      'show-three-rises-and-falls-of-roller-C-and-close-without-teleporting-the-screw',
    reasonForConeStation:
      'Brown\'s side view sets roller C a quarter of the cone length from the large end',
    sourceIllustratedContactAxialFraction: (
      207 - 166
    ) / (330 - 166),
    sourcePrescribesReturnReversal: false,
    sourcePrescribesUniformForwardInput: true,
  };
  root.userData.geometry = {
    coneEccentricity,
    coneLargeRadius,
    coneLength,
    coneSmallRadius,
    initialContactAxialFraction,
    maximumInputAngle,
    minimumRollerFaceClearance:
      -radiusSlope * rollerWidth,
    nutAxialPosition,
    radiusDerivativePerInputRadian,
    radiusSlope,
    rollerAxialCenter,
    rollerContactAxialPosition,
    rollerRadius,
    rollerWidth,
    leftInputJournalXEnd,
    leftInputJournalXStart,
    minimumScrewCoreToRollerAxialClearance:
      rightScrewCoreXStart
        + translationDerivativePerInputRadian * maximumInputAngle
        - (rollerContactAxialPosition + rollerWidth),
    rightScrewCoreXEnd,
    rightScrewCoreXStart,
    screwCoreRadius,
    screwLead,
    screwThreadHand,
    screwThreadRadius,
    screwThreadXEnd,
    screwThreadXStart,
    minimumThreadToConeAxialGap:
      screwThreadXStart - coneLength / 2,
    translationDerivativePerInputRadian,
  };
  root.userData.mechanism =
    'fixed-nut-E-converts-uniform-screw-D-rotation-to-one-lead-per-turn-translation-of-eccentric-cone-B-which-friction-drives-roller-C-at-changing-speed-and-reciprocates-it-with-unequal-rise-and-fall';
  root.userData.pairedMechanismKey =
    'movements-262-263-eccentric-screw-cone-friction-reverser';
  root.userData.presentationView = presentationView;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official paired 262-263 page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    pairedViews: {
      movement262: 'end-view',
      movement263: 'side-view',
    },
    plate262263: {
      imageHeight: 263,
      imageWidth: 525,
      identicalLocalAssetsForBothNumbers: true,
      inferredTopology:
        'one eccentric conical body rigid with one translating screw through fixed nut E and one spring-or-weight-loaded parallel-axis friction roller C',
      measurementUncertaintyPixels: 6,
      officialAnimationAvailable: false,
      rasterEndView: {
        coneCenterB: { x: 67, y: 164 },
        coneOuterRadius: 55,
        rollerCenterC: { x: 70, y: 95 },
        rollerOuterRadius: 16,
        screwCenterD: { x: 67, y: 177 },
      },
      rasterSideView: {
        coneLargeEndX: 166,
        coneLargeRadius: 43,
        coneSmallEndX: 330,
        coneSmallRadius: 20,
        fixedNutCenterX: 383,
        rollerCenterX: 207,
        rollerOuterRadius: 13,
        screwAxisY: 146,
        screwThreadPitch: 7,
      },
      view:
        'combined-end-view-262-and-side-view-263-of-one-three-dimensional-mechanism',
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
    directionChangeAngles,
    directionIntervals,
    longerDirectionTravel,
    maximumRollerAngularRatio,
    minimumRollerAngularRatio,
    reciprocation: 'spring-loaded-vertical-travel-of-roller-C',
    rollerSpinReverses: minimumRollerAngularRatio < 0
      && maximumRollerAngularRatio > 0,
    shorterDirectionTravel,
    sourceRequiredInequality:
      'roller-C-rises-less-than-it-falls-as-the-contact-spirals-toward-the-small-end',
  };
  root.userData.timeline = {
    cycleClosure: demonstrationPeriod,
    demonstrationPeriod,
    forwardTraverseEnd: demonstrationPeriod / 2,
    reverseReturnEnd: demonstrationPeriod,
  };
  root.userData.transmission = {
    configurationAtInputAngle,
    coneRadiusAtLocalAxialPosition: radiusAtLocalAxialPosition,
    contactSpiralPitch: screwLead,
    rollerAngleAtInputAngle,
    rollerAngularRatioAtInputAngle,
    rollingLaw:
      'd(roller-angle)/d(input-angle)=((cone-radius+roller-radius)*d(contact-normal-angle)/d(input-angle)-cone-radius)/roller-radius',
    screwLaw:
      'translation=-(lead/(2*pi))*input-angle',
    sourceUniformInputLaw:
      'input-angle=constant-angular-speed*time; all ratios are parameterized by input angle',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const { configuration } = state;
    screwConeAssembly.position.x = state.screwTranslation;
    screwConeAssembly.rotation.x = state.inputAngle;
    rollerCarriage.position.y = configuration.rollerCenter.y;
    rollerRotor.rotation.x = state.rollerAngle;
    contactMarker.position.copy(configuration.coneContactPoint);
    contactSpring.userData.setEndpoints(
      configuration.rollerCenter.y + .10,
      guideTop.position.y - 0.08,
    );
    root.userData.kinematics = state;
  };
  contactMarker.visible = false;
  // The raised generator line protruded into the roller's working surface.
  coneGeneratorIndex.removeFromParent();
  // Plates 262-263 draw no base slab, roller guide posts, spring or white
  // marks: only the cone, the screw, roller C on a short axle and the footed
  // standard E. The spring (or weight) that presses C on the cone is
  // described but not drawn, so its load remains an unrendered assumption.
  for (const object of [
    base,
    ...guideRails,
    guideTop,
    ...carriageBlocks,
    carriageBridge,
    contactSpring,
  ]) {
    object.removeFromParent();
    object.geometry?.dispose();
  }
  for (const key of [
    'base',
    'carriageBlocks',
    'carriageBridge',
    'contactSpring',
    'guideRails',
    'guideTop',
  ]) delete root.userData.blocks[key];
  rollerIndex.visible = false;
  rollerAxle.geometry.dispose();
  rollerAxle.geometry = cylinderAlongX(0.065, 0.62, darkMaterial, 30).geometry;
  rollerAxle.position.x = 0;
  rollerAxle.userData.role = 'short-axle-of-friction-roller-C';
  nutPost.geometry.dispose();
  // Plate 262 draws E as a low footed cradle whose foot plate lies just
  // below B's rim; plate 263 keeps its own standard.
  nutPost.geometry = presentationView === 'end-view'
    // Seen along the screw from the large end, z is the visible width. The
    // neck and the leg tops stand behind B; below B's rim the foot plate and two
    // splayed cove legs show (Brown: foot underside 73 px and top 64 px of B's
    // 55 px radius below B's centre, foot 36 px either side). B's offset swings
    // its rim 26 px lower half a turn later, so at Brown's size the whole stand
    // vanished behind B. The foot sits 3 px lower and spreads to 48 px either
    // side, so its ends and the flaring leg roots stay visible beside B's
    // lowest rim and B never looks unsupported.
    ? splayedLegStandGeometry({
      bottomY: coneEccentricity - coneLargeRadius * 76 / 55,
      footHalfZ: 1.05,
      footTopY: coneEccentricity - coneLargeRadius * 67 / 55,
      halfDepth: 0.12,
      legTopY: -0.66,
      legTopZ: 0.55,
      legWidth: 0.1,
      neckHalfZ: 0.08,
      topY: -0.309,
    })
    : flaredPedestalGeometry({
      bottomY: -1.34,
      footHalfX: 0.5,
      footHalfZ: 0.95,
      footTopY: -1.27,
      neckBottomY: -0.72,
      neckHalfX: 0.13,
      neckHalfZ: 0.2,
      topY: -0.309,
    });
  let largeEndBoss = null;
  if (presentationView === 'end-view') {
    // Seen from the large end, the carrier bar and its joint balls would lie
    // across B's face. Brown draws a plain face with one circle round D (18
    // of B's 55 px) and D's end as a dot, so the large-end carrier becomes a
    // round boss on the screw, standing slightly proud of B.
    const largeEndCarrier = eccentricConnectors[0];
    largeEndCarrier.traverse((object) => object.geometry?.dispose());
    largeEndCarrier.clear();
    const bossRadius = coneLargeRadius * 18 / 55;
    largeEndBoss = cylinderAlongX(bossRadius, 0.07, inputMaterial, 72);
    // A chamfered outer edge lets the boss read against B's face without an
    // ink ring: local +Y (the smaller top) faces outward along world -X.
    largeEndBoss.geometry.dispose();
    largeEndBoss.geometry = new THREE.CylinderGeometry(
      bossRadius * 0.84, bossRadius, 0.07, 72);
    largeEndBoss.userData.role = 'round-large-end-boss-round-screw-D';
    largeEndCarrier.add(largeEndBoss);
    largeEndCarrier.userData.setEndpoints = () => {};
    largeEndCarrier.position.set(-coneLength / 2 - 0.035, 0, 0);
    largeEndCarrier.rotation.set(0, 0, 0);
  }
  if (presentationView === 'end-view') {
    // Seen from the large end, the stand faces away from the key light and
    // read as a black slab; lift it to the frame grey of the other plates.
    nutPost.material = frameMaterial.clone();
    nutPost.material.emissive = new THREE.Color(PALETTE.frame).multiplyScalar(0.45);
  }
  nutPost.position.set(nutAxialPosition, 0, 0);
  nutPost.userData.role = 'source-footed-standard-E-carrying-nut';
  root.userData.minimumDisplayCycleSeconds = 12;
  root.userData.cameraFov = presentationView === 'end-view' ? 2 : 8;
  root.userData.reconstructionNote = 'The eccentric cone, at Brown\'s offset of about a quarter of its radius, drives roller C at a changing speed and lifts and lowers it once per turn; as the contact spirals toward the small end each fall is longer than the rise before it. As in the plates, the spring or weight that presses roller C on the cone and the guide of C are not drawn; the height of C follows the cone. The screw runs uniformly between short end ramps and returns after three turns to repeat the demonstration; this return is not specified in the engraving.';
  fitPistonGuide(root, update, demonstrationPeriod);
  markShadows(root);
  // The flush boss must not print a ring of shadow on B's plain face.
  if (largeEndBoss) largeEndBoss.castShadow = false;
  return {
    root,
    update,
    // Plate 262 looks along the screw at B's large end: D's boss shows below
    // B's centre, standard E stands behind B with only its feet below the
    // rim, and roller C rides over B's rim.
    cameraDirection: presentationView === 'end-view'
      ? new THREE.Vector3(-14, .12, 0)
      : new THREE.Vector3(-.5, .2, 14),
  };
}

export function createAuthoredEccentricConeDriveMovement(movement) {
  if (movement.id !== 262 && movement.id !== 263) return null;
  const result = eccentricConeFrictionReverser(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
