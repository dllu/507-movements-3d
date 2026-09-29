import { DEBAUFRE_300_301_PALLET } from './baked/debaufre-300-301-pallet.js';
import ANCHOR_238_WHEEL from './baked/six-point-anchor-238-wheel.js';
import {
  DESIGN as ANCHOR_238,
  anchorOutline as anchorOutline238,
  makeOverlapTest as makeOverlapTest238,
  palletAngleAt as palletAngle238,
  rotate as rotate238,
  starOutline as starOutline238,
} from './six-point-anchor-238.js';
import * as THREE from 'three';
import { plate, polygonClipping, ring } from './finite-plate-geometry.js';
import { makeSpokedWheel } from './spoked-wheel.js';
import { backBar, freezeFitBoundsWithout, supportMaterial } from './back-plate-support.js';
import {
  PALETTE,
  makeBeam,
  makeGear,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';
import { creaseIndexedNormals } from './crease-normals.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const FULL_TURN = Math.PI * 2;

// Box-fit camera distance for 301's cropped side bounds (fov 2.5, square
// view).
const EXPECTED_301_FIT_DISTANCE = 121.16;

function finish(
  root,
  update,
  cameraDirection = new THREE.Vector3(6.4, -7.2, 6.8),
) {
  root.userData.fidelity = 'authored';
  markShadows(root);
  return { root, update, cameraDirection };
}

function centeredExtrusion(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(0.025, depth * 0.12),
    bevelThickness: Math.min(0.025, depth * 0.12),
    curveSegments: 18,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function smoother(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (10 + u * (-15 + 6 * u));
}

function smootherDerivative(value) {
  if (value <= 0 || value >= 1) return 0;
  return 30 * value ** 2 * (1 - value) ** 2;
}

function smootherSecondDerivative(value) {
  if (value <= 0 || value >= 1) return 0;
  return 60 * value * (1 - value) * (1 - 2 * value);
}

function segmentProgress(cyclePhase, start, end) {
  const span = end - start;
  const u = (cyclePhase - start) / span;
  if (u <= 0) return { acceleration: 0, progress: 0, speed: 0 };
  if (u >= 1) return { acceleration: 0, progress: 1, speed: 0 };
  return {
    acceleration: smootherSecondDerivative(u) / span ** 2,
    progress: smoother(u),
    speed: smootherDerivative(u) / span,
  };
}

// One crown tooth cut from the wheel's cylindrical rim: a curved wall segment
// with the rim's own inner and outer radii, a top ramping helically from the
// root at the back to the tip, and a radial axial face at the tip. Walls carry
// radial normals so the tooth shades continuously with the band below it.
function curvedSawToothGeometry({
  backAngle,
  backExponent = 1,
  baseZ,
  innerRadius,
  outerRadius,
  rootZ,
  tipAngle,
  tipZ,
}) {
  const segments = Math.max(8, Math.ceil(backAngle / 0.02));
  const start = tipAngle - backAngle;
  const positions = [];
  const normals = [];
  const polar = (radius, angle, z) => new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
  // An exponent above one sags the back into a concave sweep (Brown's 299).
  const topZ = (angle) => rootZ + (tipZ - rootZ)
    * Math.max(0, (angle - start) / backAngle) ** backExponent;
  const triangle = (points, desired, vertexNormals = null) => {
    const [a, b, c] = points;
    const geometric = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    const flip = geometric.dot(desired) < 0;
    const ordered = flip ? [a, c, b] : [a, b, c];
    const orderedNormals = vertexNormals ? (flip ? [vertexNormals[0], vertexNormals[2], vertexNormals[1]] : vertexNormals) : null;
    const faceNormal = geometric.normalize().multiplyScalar(flip ? -1 : 1);
    ordered.forEach((p, k) => {
      positions.push(p.x, p.y, p.z);
      const n = orderedNormals ? orderedNormals[k] : faceNormal;
      normals.push(n.x, n.y, n.z);
    });
  };
  const quad = (a, b, c, d, desired, vertexNormals) => {
    triangle([a, b, c], desired, vertexNormals && [vertexNormals[0], vertexNormals[1], vertexNormals[2]]);
    triangle([a, c, d], desired, vertexNormals && [vertexNormals[0], vertexNormals[2], vertexNormals[3]]);
  };
  for (let i = 0; i < segments; i += 1) {
    const a0 = start + backAngle * i / segments, a1 = start + backAngle * (i + 1) / segments;
    const mid = (a0 + a1) / 2;
    const out0 = new THREE.Vector3(Math.cos(a0), Math.sin(a0), 0), out1 = new THREE.Vector3(Math.cos(a1), Math.sin(a1), 0);
    const outward = new THREE.Vector3(Math.cos(mid), Math.sin(mid), 0);
    quad(polar(outerRadius, a0, baseZ), polar(outerRadius, a1, baseZ), polar(outerRadius, a1, topZ(a1)), polar(outerRadius, a0, topZ(a0)),
      outward, [out0, out1, out1, out0]);
    const in0 = out0.clone().negate(), in1 = out1.clone().negate();
    quad(polar(innerRadius, a0, baseZ), polar(innerRadius, a1, baseZ), polar(innerRadius, a1, topZ(a1)), polar(innerRadius, a0, topZ(a0)),
      outward.clone().negate(), [in0, in1, in1, in0]);
    const up = new THREE.Vector3(0, 0, 1);
    quad(polar(outerRadius, a0, topZ(a0)), polar(outerRadius, a1, topZ(a1)), polar(innerRadius, a1, topZ(a1)), polar(innerRadius, a0, topZ(a0)), up);
    quad(polar(outerRadius, a0, baseZ), polar(outerRadius, a1, baseZ), polar(innerRadius, a1, baseZ), polar(innerRadius, a0, baseZ), up.clone().negate());
  }
  const tangent = (angle) => new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
  quad(polar(innerRadius, start, baseZ), polar(outerRadius, start, baseZ), polar(outerRadius, start, rootZ), polar(innerRadius, start, rootZ),
    tangent(start).negate());
  quad(polar(innerRadius, tipAngle, baseZ), polar(outerRadius, tipAngle, baseZ), polar(outerRadius, tipAngle, tipZ), polar(innerRadius, tipAngle, tipZ),
    tangent(tipAngle));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

// Brown's 299 saw tooth: the leading face is raked, running straight from a
// foot a little behind the tip up to the tip, so the tip overhangs forward
// and the next tooth's concave back starts under that overhang at the foot.
// The solid lies between the leading-face line (below) and the back (above)
// over the raked stretch, and between the band and the back elsewhere.
function rakedSawToothGeometry({
  backAngle,
  backExponent = 1,
  baseZ,
  innerRadius,
  outerRadius,
  rakeAngle,
  rootZ,
  tipAngle,
  tipZ,
}) {
  const start = tipAngle - backAngle;
  const foot = tipAngle - rakeAngle;
  const flatSegments = Math.max(6, Math.ceil((backAngle - rakeAngle) / 0.02));
  const rakeSegments = Math.max(6, Math.ceil(rakeAngle / 0.012));
  const angles = [];
  for (let i = 0; i <= flatSegments; i += 1) angles.push(start + (foot - start) * i / flatSegments);
  for (let i = 1; i <= rakeSegments; i += 1) angles.push(foot + rakeAngle * i / rakeSegments);
  const topZ = (angle) => rootZ + (tipZ - rootZ)
    * Math.max(0, (angle - start) / backAngle) ** backExponent;
  const topSlope = (angle) => (tipZ - rootZ) * backExponent
    * Math.max(1e-9, (angle - start) / backAngle) ** (backExponent - 1) / backAngle;
  const bottomZ = (angle) => (angle <= foot
    ? baseZ
    : baseZ + (tipZ - baseZ) * Math.min(1, (angle - foot) / rakeAngle));
  const positions = [];
  const normals = [];
  const polar = (radius, angle, z) => new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
  const triangle = (points, desired, vertexNormals = null) => {
    const [a, b, c] = points;
    const geometric = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (geometric.lengthSq() < 1e-18) return;
    const flip = geometric.dot(desired) < 0;
    const ordered = flip ? [a, c, b] : [a, b, c];
    const orderedNormals = vertexNormals ? (flip ? [vertexNormals[0], vertexNormals[2], vertexNormals[1]] : vertexNormals) : null;
    const faceNormal = geometric.normalize().multiplyScalar(flip ? -1 : 1);
    ordered.forEach((p, k) => {
      positions.push(p.x, p.y, p.z);
      const n = orderedNormals ? orderedNormals[k] : faceNormal;
      normals.push(n.x, n.y, n.z);
    });
  };
  const quad = (a, b, c, d, desired, vertexNormals) => {
    triangle([a, b, c], desired, vertexNormals && [vertexNormals[0], vertexNormals[1], vertexNormals[2]]);
    triangle([a, c, d], desired, vertexNormals && [vertexNormals[0], vertexNormals[2], vertexNormals[3]]);
  };
  const up = new THREE.Vector3(0, 0, 1);
  const down = up.clone().negate();
  for (let i = 0; i + 1 < angles.length; i += 1) {
    const a0 = angles[i], a1 = angles[i + 1];
    const mid = (a0 + a1) / 2;
    const b0 = bottomZ(a0), b1 = bottomZ(a1), t0 = topZ(a0), t1 = topZ(a1);
    const out0 = new THREE.Vector3(Math.cos(a0), Math.sin(a0), 0), out1 = new THREE.Vector3(Math.cos(a1), Math.sin(a1), 0);
    const outward = new THREE.Vector3(Math.cos(mid), Math.sin(mid), 0);
    quad(polar(outerRadius, a0, b0), polar(outerRadius, a1, b1), polar(outerRadius, a1, t1), polar(outerRadius, a0, t0),
      outward, [out0, out1, out1, out0]);
    const in0 = out0.clone().negate(), in1 = out1.clone().negate();
    quad(polar(innerRadius, a0, b0), polar(innerRadius, a1, b1), polar(innerRadius, a1, t1), polar(innerRadius, a0, t0),
      outward.clone().negate(), [in0, in1, in1, in0]);
    // Smooth analytic normals on the curved back and the raked face: flat
    // per-strip normals read as fine striping on these nearly edge-on faces.
    // Normal of (r cos a, r sin a, z(a)) is (z' sin a, -z' cos a, r).
    const surfaceNormal = (radius, angle, slope, sign) => new THREE.Vector3(
      slope * Math.sin(angle), -slope * Math.cos(angle), radius,
    ).normalize().multiplyScalar(sign);
    const bottomSlope = mid <= foot ? 0 : (tipZ - baseZ) / rakeAngle;
    quad(polar(outerRadius, a0, t0), polar(outerRadius, a1, t1), polar(innerRadius, a1, t1), polar(innerRadius, a0, t0), up,
      [surfaceNormal(outerRadius, a0, topSlope(a0), 1), surfaceNormal(outerRadius, a1, topSlope(a1), 1),
        surfaceNormal(innerRadius, a1, topSlope(a1), 1), surfaceNormal(innerRadius, a0, topSlope(a0), 1)]);
    quad(polar(outerRadius, a0, b0), polar(outerRadius, a1, b1), polar(innerRadius, a1, b1), polar(innerRadius, a0, b0), down,
      [surfaceNormal(outerRadius, a0, bottomSlope, -1), surfaceNormal(outerRadius, a1, bottomSlope, -1),
        surfaceNormal(innerRadius, a1, bottomSlope, -1), surfaceNormal(innerRadius, a0, bottomSlope, -1)]);
  }
  const tangent = (angle) => new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
  quad(polar(innerRadius, start, baseZ), polar(outerRadius, start, baseZ), polar(outerRadius, start, rootZ), polar(innerRadius, start, rootZ),
    tangent(start).negate());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function makeCrownEscapeWheel({
  bodyDepth,
  bodyRadius,
  contactRadius,
  floorAtToothBase = false,
  mountPhase,
  toothBaseZ,
  toothBackExponent = 1,
  toothCount,
  toothRadialDepth,
  toothRakeFraction = 0,
  toothTipZ,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.rotor = rotor;

  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const toothMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });

  const toothPitch = FULL_TURN / toothCount;
  const innerRadius = contactRadius - toothRadialDepth;
  const outerRadius = contactRadius;

  // A crown is a cup: the teeth stand on a band of their own radial depth,
  // closed below by a thin floor, with nothing projecting beyond the teeth.
  const floorThickness = Math.min(0.1, bodyDepth * 0.4);
  const bandShape = new THREE.Shape();
  bandShape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  bandShape.holes.push(new THREE.Path().absarc(0, 0, innerRadius, 0, FULL_TURN, true));
  const band = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bandShape, { bevelEnabled: false, curveSegments: 64, depth: bodyDepth }),
    wheelMaterial,
  );
  band.position.z = toothBaseZ - bodyDepth;
  band.userData.role = 'crown-wheel-tooth-band';
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(innerRadius + 0.01, innerRadius + 0.01, floorThickness, 96),
    wheelMaterial,
  );
  floor.rotation.x = Math.PI / 2;
  // Brown's 234 shows the plate flush with the top of the band, where the
  // teeth start, pierced only by the arbor; the others close the cup below.
  const floorTopZ = floorAtToothBase
    ? toothBaseZ
    : toothBaseZ - bodyDepth + floorThickness;
  floor.position.z = floorTopZ - floorThickness / 2;
  floor.userData.role = 'crown-wheel-floor';
  const body = new THREE.Group();
  body.add(band, floor);
  body.userData.role = 'crown-wheel-body';
  rotor.add(body);

  // With a flush plate the arbor only shows as its bore: the hub stays under
  // the plate and a dark disk stands for the hole drawn at its centre.
  const hubDepth = floorAtToothBase ? bodyDepth * 0.9 : bodyDepth * 1.9;
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, hubDepth, 32),
    darkMaterial,
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = floorAtToothBase
    ? floorTopZ - floorThickness - hubDepth / 2 + 0.002
    : toothBaseZ - bodyDepth * 0.18;
  hub.userData.role = 'crown-wheel-hub';
  rotor.add(hub);
  if (floorAtToothBase) {
    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.012, 32),
      darkMaterial,
    );
    bore.rotation.x = Math.PI / 2;
    bore.position.z = floorTopZ + 0.004;
    bore.userData.role = 'crown-wheel-arbor-bore';
    rotor.add(bore);
  }

  // Saw teeth cut from the rim: an axial leading face in the counterclockwise
  // running direction and a helically inclined back, as in Brown's crown
  // wheels. A radial tip edge is oblique to both pallet planes, and its outer
  // corner is always the first point to reach them, so that corner lies on
  // the contact orbit.
  // A raked tooth (299) has no flat gap: its back starts at the foot of the
  // leading face of the tooth behind it.
  const toothRakeAngle = toothRakeFraction * toothPitch;
  const toothBackAngle = toothRakeAngle > 0
    ? toothPitch + toothRakeAngle
    : toothPitch * 0.8;
  const toothMeshes = [];
  const toothTips = [];

  for (let index = 0; index < toothCount; index += 1) {
    const angle = mountPhase + index * toothPitch;
    const geometry = toothRakeAngle > 0 ? rakedSawToothGeometry({
      backAngle: toothBackAngle,
      backExponent: toothBackExponent,
      baseZ: toothBaseZ - 0.01,
      innerRadius,
      outerRadius,
      rakeAngle: toothRakeAngle,
      rootZ: toothBaseZ,
      tipAngle: angle,
      tipZ: toothTipZ,
    }) : curvedSawToothGeometry({
      backAngle: toothBackAngle,
      backExponent: toothBackExponent,
      baseZ: toothBaseZ - 0.01,
      innerRadius,
      outerRadius,
      rootZ: toothBaseZ,
      tipAngle: angle,
      tipZ: toothTipZ,
    });
    const tooth = new THREE.Mesh(geometry, toothMaterial);
    tooth.userData.index = index;
    tooth.userData.mountAngle = angle;
    tooth.userData.role = 'axial-saw-tooth';
    toothMeshes.push(tooth);
    rotor.add(tooth);

    const tip = new THREE.Vector3(
      Math.cos(angle) * contactRadius,
      Math.sin(angle) * contactRadius,
      toothTipZ,
    );
    toothTips.push(tip);
  }

  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(innerRadius * 0.5, 0.075, 0.035),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  indicator.position.set(innerRadius * 0.45, 0, floorTopZ + 0.0175);
  indicator.userData.role = 'crown-wheel-rotation-witness';
  rotor.add(indicator);

  root.userData.body = body;
  root.userData.toothBandRadius = (innerRadius + outerRadius) / 2;
  root.userData.contactRadius = contactRadius;
  root.userData.toothInnerRadius = innerRadius;
  root.userData.toothBaseZ = toothBaseZ;
  // Callers address the white witness through this (234's tests; 302 hides it).
  root.userData.indicator = indicator;
  root.userData.mountPhase = mountPhase;
  root.userData.teeth = toothCount;
  root.userData.toothMeshes = toothMeshes;
  root.userData.toothPitch = toothPitch;
  root.userData.toothBackAngle = toothBackAngle;
  root.userData.toothRakeAngle = toothRakeAngle;
  root.userData.toothTips = toothTips;
  return root;
}

function vergeAndCrownWheelEscapement(
  movement,
  {
    bodyDepth = 0.34,
    flagPallets = false,
    floorAtToothBase = false,
    includeFrame = true,
    palletThickness = 0.105,
    palletWidth = 0.5,
    roundSpindle = false,
    spindleLength = 7.25,
    toothBackExponent = 1,
    toothRadialDepth = 0.34,
    toothRakeFraction = 0,
    toothTipZ = 1,
    vergeAmplitudeDegrees = 25,
    displayCycleOffset = 0,
    heightToRadiusRatioOverride = null,
    palletIncludedAngleDegrees = 100,
    toothCount = 13,
  } = {},
) {
  const root = new THREE.Group();
  const toothPitch = FULL_TURN / toothCount;
  const halfToothPitch = toothPitch / 2;
  const dropFractionOfPitch = 0.1;
  const dropAngle = dropFractionOfPitch * toothPitch;
  const contactAdvance = halfToothPitch - dropAngle;
  const contactRadius = 2.2;
  const bodyRadius = 2.52;
  const toothBaseZ = 0;
  const palletIncludedAngle = THREE.MathUtils.degToRad(
    palletIncludedAngleDegrees,
  );
  const palletHalfAngle = palletIncludedAngle / 2;
  const vergeAmplitude = THREE.MathUtils.degToRad(vergeAmplitudeDegrees);
  const cyclePeriod = 4;
  const cyclesPerSecond = 1 / cyclePeriod;
  const phases = {
    firstDrop: { start: 0.34, end: 0.4 },
    leftDrive: { start: 0.58, end: 0.82 },
    rightDrive: { start: 0.1, end: 0.34 },
    secondDrop: { start: 0.82, end: 0.88 },
  };

  const targetContactTravel = contactAdvance;
  let lowerRatio = 0;
  let upperRatio = 0.99 / Math.tan(palletHalfAngle + vergeAmplitude);
  for (let iteration = 0; iteration < 96; iteration += 1) {
    const ratio = (lowerRatio + upperRatio) / 2;
    const travel = Math.asin(
      ratio * Math.tan(palletHalfAngle + vergeAmplitude),
    ) - Math.asin(
      ratio * Math.tan(palletHalfAngle - vergeAmplitude),
    );
    if (travel > targetContactTravel) upperRatio = ratio;
    else lowerRatio = ratio;
  }
  // Derived escapements with their own motion law (302) may fix the verge
  // height directly; this base law then only supplies the surfaces.
  const heightToRadiusRatio = heightToRadiusRatioOverride
    ?? (lowerRatio + upperRatio) / 2;
  const heightDrop = heightToRadiusRatio * contactRadius;
  const vergeAxisZ = toothTipZ + heightDrop;

  const contactAngleAtPalletAngle = (palletAngle) => Math.asin(
    heightToRadiusRatio * Math.tan(palletAngle),
  );
  const contactAngleDerivative = (palletAngle) => {
    const tangent = Math.tan(palletAngle);
    const secantSquared = 1 + tangent ** 2;
    const argument = heightToRadiusRatio * tangent;
    return heightToRadiusRatio * secantSquared
      / Math.sqrt(1 - argument ** 2);
  };
  const contactAngleSecondDerivative = (palletAngle) => {
    const tangent = Math.tan(palletAngle);
    const secantSquared = 1 + tangent ** 2;
    const argument = heightToRadiusRatio * tangent;
    const firstArgumentDerivative = heightToRadiusRatio * secantSquared;
    const secondArgumentDerivative = 2 * heightToRadiusRatio
      * secantSquared * tangent;
    const denominator = Math.sqrt(1 - argument ** 2);
    return secondArgumentDerivative / denominator
      + argument * firstArgumentDerivative ** 2 / denominator ** 3;
  };

  const dropContactAngle = contactAngleAtPalletAngle(
    palletHalfAngle - vergeAmplitude,
  );
  const releaseContactAngle = contactAngleAtPalletAngle(
    palletHalfAngle + vergeAmplitude,
  );
  const mountPhase = dropContactAngle;
  const palletRootDistance = heightDrop / Math.cos(
    palletHalfAngle - vergeAmplitude,
  );
  const palletTipDistance = heightDrop / Math.cos(
    palletHalfAngle + vergeAmplitude,
  );
  const palletFaceSpan = palletTipDistance - palletRootDistance;
  const palletFaceMidDistance = (
    palletRootDistance + palletTipDistance
  ) / 2;
  const palletCenterX = contactRadius * (
    Math.cos(dropContactAngle) + Math.cos(releaseContactAngle)
  ) / 2;

  const crownWheel = makeCrownEscapeWheel({
    bodyDepth,
    bodyRadius,
    contactRadius,
    floorAtToothBase,
    mountPhase,
    toothBackExponent,
    toothBaseZ,
    toothCount,
    toothRadialDepth,
    toothRakeFraction,
    toothTipZ,
  });
  root.add(crownWheel);

  const crownShaft = makeShaft({ length: 3.25, radius: floorAtToothBase ? 0.2 : 0.14 });
  // A flush plate hides the arbor end, so the shaft stops under the plate.
  crownShaft.position.z = floorAtToothBase ? -0.1 - 3.25 / 2 : -1.3;
  crownShaft.userData.role = 'vertical-crown-wheel-arbor';
  root.add(crownShaft);

  const verge = new THREE.Group();
  verge.position.z = vergeAxisZ;
  verge.userData.axis = X_AXIS.clone();
  const vergeMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.6,
  });
  const palletMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.5,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  // Brown's 234 draws S as a plain round rod.
  const spindle = new THREE.Mesh(
    roundSpindle
      ? new THREE.CylinderGeometry(0.075, 0.075, spindleLength, 24)
      : new THREE.BoxGeometry(spindleLength, 0.14, 0.13),
    vergeMaterial,
  );
  if (roundSpindle) spindle.rotation.z = Math.PI / 2;
  spindle.userData.role = 'oscillating-spindle-S';
  verge.add(spindle);
  for (const x of [-(spindleLength / 2 - 0.065), spindleLength / 2 - 0.065]) {
    const endCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.22, 24),
      darkMaterial,
    );
    endCap.rotation.z = Math.PI / 2;
    endCap.position.x = x;
    endCap.userData.role = 'verge-end-journal';
    verge.add(endCap);
  }
  const vergeWitness = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 12),
    matte(PALETTE.white, { roughness: 0.45 }),
  );
  vergeWitness.position.set(-2.95, 0.13, 0.13);
  vergeWitness.userData.role = 'verge-rotation-witness';
  verge.add(vergeWitness);

  const makePallet = (side, baseAngle) => {
    const pallet = new THREE.Group();
    pallet.rotation.x = baseAngle;
    pallet.userData.baseAngle = baseAngle;
    pallet.userData.side = side;
    const x = (side === 'right' ? 1 : -1) * palletCenterX;
    // The tooth pushes the right face toward local +y and the left face toward
    // local -y, so each pallet body lies on the side away from the teeth.
    const bodySide = side === 'right' ? 1 : -1;
    pallet.userData.bodySide = bodySide;
    // Brown's flags A are plain plates hung from the spindle: the neck then
    // continues the face at its full width and thickness.
    const neckWidth = flagPallets ? palletWidth : palletWidth * 0.62;
    const neckThickness = flagPallets ? palletThickness : 0.16;
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(neckWidth, neckThickness, palletRootDistance),
      flagPallets ? palletMaterial : vergeMaterial,
    );
    neck.position.set(x, bodySide * neckThickness / 2, -palletRootDistance / 2);
    neck.userData.role = `${side}-pallet-neck`;
    pallet.add(neck);
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(
        palletWidth,
        palletThickness,
        palletFaceSpan,
      ),
      palletMaterial,
    );
    face.position.set(
      x,
      bodySide * palletThickness / 2,
      -palletFaceMidDistance,
    );
    face.userData.contactFaceAtLocalY = 0;
    face.userData.role = `${side}-pallet-A-contact-face`;
    pallet.add(face);
    const tipEdge = new THREE.Mesh(
      new THREE.BoxGeometry(palletWidth * 1.05, 0.024, 0.04),
      darkMaterial,
    );
    tipEdge.position.set(
      x,
      bodySide * (palletThickness + 0.012),
      -palletTipDistance + 0.02,
    );
    tipEdge.userData.role = `${side}-pallet-release-edge`;
    // The flags have no separate dark lip.
    if (!flagPallets) pallet.add(tipEdge);
    verge.add(pallet);
    return { face, neck, pallet, tipEdge };
  };
  const rightPallet = makePallet('right', palletHalfAngle);
  const leftPallet = makePallet('left', -palletHalfAngle);
  root.add(verge);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const bearingX = 3.3;
  const bearingRadius = 0.23;
  const bearings = includeFrame ? [-bearingX, bearingX].map((x, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(bearingRadius, 0.065, 10, 36),
      frameMaterial,
    );
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(x, 0, vergeAxisZ);
    bearing.userData.role = index === 0
      ? 'left-verge-bearing'
      : 'right-verge-bearing';
    return bearing;
  }) : [];
  const baseZ = -2.65;
  const rearY = 0.92;
  const frameBeams = includeFrame ? [
    makeBeam(
      new THREE.Vector3(-3.65, rearY, baseZ),
      new THREE.Vector3(3.65, rearY, baseZ),
      { color: PALETTE.frame, depth: 0.2, thickness: 0.2 },
    ),
    ...[-bearingX, bearingX].map((x) => makeBeam(
      new THREE.Vector3(x, rearY, baseZ),
      new THREE.Vector3(x, rearY, vergeAxisZ),
      { color: PALETTE.frame, depth: 0.2, thickness: 0.18 },
    )),
    ...[-bearingX, bearingX].map((x) => makeBeam(
      new THREE.Vector3(x, 0, vergeAxisZ),
      new THREE.Vector3(x, rearY, vergeAxisZ),
      { color: PALETTE.frame, depth: 0.2, thickness: 0.18 },
    )),
    makeBeam(
      new THREE.Vector3(-3.65, -0.4, baseZ),
      new THREE.Vector3(-3.65, 1.65, baseZ),
      { color: PALETTE.frame, depth: 0.2, thickness: 0.2 },
    ),
    makeBeam(
      new THREE.Vector3(3.65, -0.4, baseZ),
      new THREE.Vector3(3.65, 1.65, baseZ),
      { color: PALETTE.frame, depth: 0.2, thickness: 0.2 },
    ),
  ] : [];
  frameBeams.forEach((beam) => { beam.userData.role = 'escapement-frame'; });
  if (includeFrame) root.add(...bearings, ...frameBeams);

  const rightContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 22, 14),
    matte(PALETTE.white, { roughness: 0.42 }),
  );
  rightContactMarker.userData.role = 'right-pallet-contact-marker';
  // Diagnostic only: a marker at the contact point necessarily intersects
  // both the tooth and the pallet, so it tracks the contact without rendering.
  rightContactMarker.visible = false;
  const leftContactMarker = rightContactMarker.clone();
  leftContactMarker.userData.role = 'left-pallet-contact-marker';
  root.add(rightContactMarker, leftContactMarker);

  const toothTipAt = (toothIndex, wheelAngle) => {
    const angle = mountPhase + toothIndex * toothPitch + wheelAngle;
    return {
      angle,
      point: new THREE.Vector3(
        Math.cos(angle) * contactRadius,
        Math.sin(angle) * contactRadius,
        toothTipZ,
      ),
    };
  };

  const palletMetrics = (side, toothIndex, vergeAngle, wheelAngle) => {
    const sideSign = side === 'right' ? 1 : -1;
    const baseAngle = sideSign * palletHalfAngle;
    const palletAngle = baseAngle + vergeAngle;
    const { angle: toothWorldAngle, point } = toothTipAt(
      toothIndex,
      wheelAngle,
    );
    const shaftPoint = new THREE.Vector3(point.x, 0, vergeAxisZ);
    const pointFromShaft = point.clone().sub(shaftPoint);
    const faceDirection = new THREE.Vector3(
      0,
      Math.sin(palletAngle),
      -Math.cos(palletAngle),
    );
    const faceNormal = new THREE.Vector3(
      0,
      Math.cos(palletAngle),
      Math.sin(palletAngle),
    );
    const targetToothWorldAngle = side === 'right'
      ? contactAngleAtPalletAngle(palletAngle)
      : Math.PI - contactAngleAtPalletAngle(palletAngle);
    return {
      contactCoordinate: (
        pointFromShaft.dot(faceDirection) - palletRootDistance
      ) / palletFaceSpan,
      faceDirection,
      faceNormal,
      longitudinalDistance: pointFromShaft.dot(faceDirection),
      palletAngle,
      palletPlaneSeparation: pointFromShaft.dot(faceNormal),
      palletWidthOffset: point.x - sideSign * palletCenterX,
      point,
      pointFromShaft,
      side,
      targetToothWorldAngle,
      toothIndex,
      toothPhaseError: normalizeAngle(
        toothWorldAngle - targetToothWorldAngle,
      ),
      toothWorldAngle,
    };
  };

  const contactAt = ({
    side,
    toothIndex,
    vergeAngle,
    vergeAngularSpeed,
    wheelAngle,
    wheelAngularSpeed,
  }) => {
    const metrics = palletMetrics(
      side,
      toothIndex,
      vergeAngle,
      wheelAngle,
    );
    const wheelVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(wheelAngularSpeed),
      metrics.point,
    );
    const palletVelocity = new THREE.Vector3().crossVectors(
      X_AXIS.clone().multiplyScalar(vergeAngularSpeed),
      metrics.pointFromShaft,
    );
    const relativeVelocity = wheelVelocity.clone().sub(palletVelocity);
    return {
      ...metrics,
      normalVelocityError: relativeVelocity.dot(metrics.faceNormal),
      palletVelocity,
      slidingVelocity: relativeVelocity.dot(metrics.faceDirection),
      wheelVelocity,
    };
  };

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const cycleWheelBase = cycleIndex * toothPitch;
    const initialRightIndex = positiveModulo(-cycleIndex, toothCount);
    const leftIndex = positiveModulo(
      initialRightIndex + (toothCount - 1) / 2,
      toothCount,
    );
    const finalRightIndex = positiveModulo(
      initialRightIndex - 1,
      toothCount,
    );

    let activePallet = 'right';
    let activeToothIndex = initialRightIndex;
    let drivingContact = false;
    let dwell = true;
    let dropProgress = null;
    let escapingPallet = null;
    let escapingToothIndex = null;
    let approachingPallet = null;
    let approachingToothIndex = null;
    let freeDrop = false;
    let stage = 'right-pallet-root-lock';
    let vergeAngle = -vergeAmplitude;
    let vergeAngleDerivative = 0;
    let vergeAngleSecondDerivative = 0;
    let wheelAngle = cycleWheelBase;
    let wheelAngleDerivative = 0;
    let wheelAngleSecondDerivative = 0;

    if (
      cyclePhase >= phases.rightDrive.start
      && cyclePhase < phases.rightDrive.end
    ) {
      const motion = segmentProgress(
        cyclePhase,
        phases.rightDrive.start,
        phases.rightDrive.end,
      );
      vergeAngle = -vergeAmplitude + 2 * vergeAmplitude * motion.progress;
      vergeAngleDerivative = 2 * vergeAmplitude * motion.speed;
      vergeAngleSecondDerivative = 2 * vergeAmplitude
        * motion.acceleration;
      const palletAngle = palletHalfAngle + vergeAngle;
      const firstDerivative = contactAngleDerivative(palletAngle);
      const secondDerivative = contactAngleSecondDerivative(palletAngle);
      wheelAngle = cycleWheelBase
        + contactAngleAtPalletAngle(palletAngle) - dropContactAngle;
      wheelAngleDerivative = firstDerivative * vergeAngleDerivative;
      wheelAngleSecondDerivative = secondDerivative
        * vergeAngleDerivative ** 2
        + firstDerivative * vergeAngleSecondDerivative;
      drivingContact = true;
      dwell = false;
      stage = 'right-tooth-slides-from-pallet-root-to-tip';
    } else if (
      cyclePhase >= phases.firstDrop.start
      && cyclePhase < phases.firstDrop.end
    ) {
      const motion = segmentProgress(
        cyclePhase,
        phases.firstDrop.start,
        phases.firstDrop.end,
      );
      activePallet = null;
      activeToothIndex = null;
      approachingPallet = 'left';
      approachingToothIndex = leftIndex;
      escapingPallet = 'right';
      escapingToothIndex = initialRightIndex;
      dropProgress = motion.progress;
      freeDrop = true;
      dwell = false;
      vergeAngle = vergeAmplitude;
      wheelAngle = cycleWheelBase + contactAdvance
        + dropAngle * motion.progress;
      wheelAngleDerivative = dropAngle * motion.speed;
      wheelAngleSecondDerivative = dropAngle * motion.acceleration;
      stage = 'right-releases-free-drop-to-left-root';
    } else if (
      cyclePhase >= phases.firstDrop.end
      && cyclePhase < phases.leftDrive.start
    ) {
      activePallet = 'left';
      activeToothIndex = leftIndex;
      vergeAngle = vergeAmplitude;
      wheelAngle = cycleWheelBase + halfToothPitch;
      stage = 'left-pallet-root-lock';
    } else if (
      cyclePhase >= phases.leftDrive.start
      && cyclePhase < phases.leftDrive.end
    ) {
      const motion = segmentProgress(
        cyclePhase,
        phases.leftDrive.start,
        phases.leftDrive.end,
      );
      activePallet = 'left';
      activeToothIndex = leftIndex;
      vergeAngle = vergeAmplitude - 2 * vergeAmplitude * motion.progress;
      vergeAngleDerivative = -2 * vergeAmplitude * motion.speed;
      vergeAngleSecondDerivative = -2 * vergeAmplitude
        * motion.acceleration;
      const palletAngle = -palletHalfAngle + vergeAngle;
      const firstDerivative = contactAngleDerivative(palletAngle);
      const secondDerivative = contactAngleSecondDerivative(palletAngle);
      wheelAngle = cycleWheelBase + halfToothPitch
        + Math.PI - contactAngleAtPalletAngle(palletAngle)
        - (Math.PI + dropContactAngle);
      wheelAngleDerivative = -firstDerivative * vergeAngleDerivative;
      wheelAngleSecondDerivative = -secondDerivative
        * vergeAngleDerivative ** 2
        - firstDerivative * vergeAngleSecondDerivative;
      drivingContact = true;
      dwell = false;
      stage = 'left-tooth-slides-from-pallet-root-to-tip';
    } else if (
      cyclePhase >= phases.secondDrop.start
      && cyclePhase < phases.secondDrop.end
    ) {
      const motion = segmentProgress(
        cyclePhase,
        phases.secondDrop.start,
        phases.secondDrop.end,
      );
      activePallet = null;
      activeToothIndex = null;
      approachingPallet = 'right';
      approachingToothIndex = finalRightIndex;
      escapingPallet = 'left';
      escapingToothIndex = leftIndex;
      dropProgress = motion.progress;
      freeDrop = true;
      dwell = false;
      vergeAngle = -vergeAmplitude;
      wheelAngle = cycleWheelBase + toothPitch - dropAngle
        + dropAngle * motion.progress;
      wheelAngleDerivative = dropAngle * motion.speed;
      wheelAngleSecondDerivative = dropAngle * motion.acceleration;
      stage = 'left-releases-free-drop-to-right-root';
    } else if (cyclePhase >= phases.secondDrop.end) {
      activeToothIndex = finalRightIndex;
      wheelAngle = cycleWheelBase + toothPitch;
      stage = 'next-right-pallet-root-lock';
    }

    const vergeAngularSpeed = vergeAngleDerivative * cyclesPerSecond;
    const vergeAngularAcceleration = vergeAngleSecondDerivative
      * cyclesPerSecond ** 2;
    const wheelAngularSpeed = wheelAngleDerivative * cyclesPerSecond;
    const wheelAngularAcceleration = wheelAngleSecondDerivative
      * cyclesPerSecond ** 2;
    const contact = activePallet === null ? null : contactAt({
      side: activePallet,
      toothIndex: activeToothIndex,
      vergeAngle,
      vergeAngularSpeed,
      wheelAngle,
      wheelAngularSpeed,
    });

    let freeDropState = null;
    if (freeDrop) {
      const escaping = palletMetrics(
        escapingPallet,
        escapingToothIndex,
        vergeAngle,
        wheelAngle,
      );
      const approaching = palletMetrics(
        approachingPallet,
        approachingToothIndex,
        vergeAngle,
        wheelAngle,
      );
      freeDropState = {
        approaching,
        approachingLongitudinalShortfall: Math.max(
          0,
          palletRootDistance - approaching.longitudinalDistance,
        ),
        approachingPlaneClearance: Math.abs(
          approaching.palletPlaneSeparation,
        ),
        escaping,
        escapingLongitudinalOverrun: Math.max(
          0,
          escaping.longitudinalDistance - palletTipDistance,
        ),
        progress: dropProgress,
      };
    }

    return {
      activePallet,
      activeToothIndex,
      contact,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      drivingContact,
      dropProgress,
      dwell,
      freeDrop,
      freeDropState,
      sourcePose: displayCycleOffset === 0
        ? cyclePhase < phases.rightDrive.start
        : Math.abs(cyclePhase - displayCycleOffset) < 1e-12,
      stage,
      teethAdvanced: wheelAngle / toothPitch,
      vergeAngle,
      vergeAngularAcceleration,
      vergeAngularSpeed,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond + displayCycleOffset,
  );

  const rightReleaseWheelAngle = contactAdvance;
  const firstLeftDropWorldAngle = mountPhase
    + ((toothCount - 1) / 2) * toothPitch
    + rightReleaseWheelAngle;
  const leftRootTargetAngle = Math.PI + dropContactAngle;
  const firstDropClearanceAngle = normalizeAngle(
    leftRootTargetAngle - firstLeftDropWorldAngle,
  );

  root.userData.archetype = 'verge-and-crown-wheel-escapement';
  root.userData.blocks = {
    bearings,
    crownShaft,
    crownWheel,
    frameBeams,
    leftContactMarker,
    leftPallet,
    rightContactMarker,
    rightPallet,
    spindle,
    verge,
    vergeWitness,
  };
  const fitHalfX = Math.max(3.85, spindleLength / 2 + 0.1);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-fitHalfX, -2.8, -2.85),
    new THREE.Vector3(fitHalfX, 2.8, 1.85),
  );
  root.userData.canonicalTimes = {
    firstFreeDropMidpoint: cyclePeriod * (
      phases.firstDrop.start + phases.firstDrop.end
    ) / 2,
    leftDriveMidpoint: cyclePeriod * (
      phases.leftDrive.start + phases.leftDrive.end
    ) / 2,
    leftRootLock: cyclePeriod * phases.firstDrop.end,
    rightDriveMidpoint: cyclePeriod * (
      phases.rightDrive.start + phases.rightDrive.end
    ) / 2,
    secondFreeDropMidpoint: cyclePeriod * (
      phases.secondDrop.start + phases.secondDrop.end
    ) / 2,
    sourcePose: 0,
  };
  // A display offset starts the clock at the source pose; the per-cycle
  // mechanism state is unchanged, so the canonical times move with it.
  for (const [key, time] of Object.entries(root.userData.canonicalTimes)) {
    if (key === 'sourcePose') continue;
    root.userData.canonicalTimes[key] = positiveModulo(
      time / cyclePeriod - displayCycleOffset,
      1,
    ) * cyclePeriod;
  }
  root.userData.contactAt = contactAt;
  root.userData.contactAngleAtPalletAngle = contactAngleAtPalletAngle;
  root.userData.contactAngleDerivative = contactAngleDerivative;
  root.userData.contactAngleSecondDerivative = contactAngleSecondDerivative;
  root.userData.geometry = {
    axialLayers: {
      crownBody: { center: toothBaseZ - bodyDepth / 2, depth: bodyDepth },
      crownTeeth: { base: toothBaseZ, tip: toothTipZ },
      palletFaces: { thickness: palletThickness },
      vergeAxis: vergeAxisZ,
    },
    bodyDepth,
    bodyRadius,
    contactAdvance,
    contactRadius,
    cyclePeriod,
    cyclesPerSecond,
    dropAngle,
    displayCycleOffset,
    dropContactAngle,
    dropFractionOfPitch,
    firstDropClearanceAngle,
    heightDrop,
    heightToRadiusRatio,
    leftRootTargetAngle,
    mountPhase,
    palletCenterX,
    palletFaceSpan,
    palletHalfAngle,
    palletIncludedAngle,
    palletRootDistance,
    palletThickness,
    palletTipDistance,
    palletWidth,
    phases,
    releaseContactAngle,
    targetContactTravel,
    toothBaseZ,
    toothCount,
    toothPitch,
    toothRadialDepth,
    toothTipZ,
    vergeAmplitude,
    vergeAxisZ,
  };
  root.userData.mechanism =
    'thirteen-tooth-crown-wheel-advances-one-half-pitch-per-pallet-through-exact-root-to-tip-contact-plus-positive-drop-clearance';
  root.userData.palletMetrics = palletMetrics;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 234 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    geometryReference: {
      author: 'Alan Emmerson',
      finding: 'A symmetrical verge requires an odd crown-wheel tooth count; release and opposite drop differ by half a tooth pitch plus positive clearance.',
      title: 'Geometry of the Verge and Crown Wheel Escapement',
      url: 'https://studylib.net/doc/5888616/geometry-of-the-verge-and-crown-wheel-escapement',
    },
    officialDescription: movement.description,
    plate234: {
      inferredTopology: 'one crown wheel, one verge spindle, two angularly offset pallets A',
      officialAnimationAvailable: false,
      rasterImageHeight: 525,
      rasterImageWidth: 525,
      rasterLeftPalletCenter: new THREE.Vector2(231, 216),
      rasterRightPalletCenter: new THREE.Vector2(338, 274),
      rasterSpindleEndpoints: [
        new THREE.Vector2(96, 117),
        new THREE.Vector2(443, 260),
      ],
      rasterWheelCenter: new THREE.Vector2(264, 291),
    },
    primaryScan: {
      edition: 21,
      printedPage: 61,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.toothTipAt = toothTipAt;
  root.userData.transmission = {
    beatsPerCycle: 2,
    contactAdvancePerBeatInToothPitches: contactAdvance / toothPitch,
    crownWheelDirection: 'counterclockwise',
    dropPerBeatInToothPitches: dropAngle / toothPitch,
    oddToothCountRequired: true,
    outputAdvancePerBeatInToothPitches: 0.5,
    outputAdvancePerOscillationInToothPitches: 1,
    palletIncludedAngleDegrees: THREE.MathUtils.radToDeg(
      palletIncludedAngle,
    ),
    topology: 'perpendicular-verge-and-crown-wheel-with-opposed-pallets',
  };
  root.userData.cameraDistanceScale = 0.94;

  const update = (time) => {
    const state = stateAtTime(time);
    verge.rotation.x = state.vergeAngle;
    setSpin(crownWheel, state.wheelAngle);
    setSpin(crownShaft, state.wheelAngle);
    rightContactMarker.userData.active = state.activePallet === 'right';
    leftContactMarker.userData.active = state.activePallet === 'left';
    if (state.contact) {
      const marker = state.activePallet === 'right'
        ? rightContactMarker
        : leftContactMarker;
      marker.position.copy(state.contact.point);
    }
    verge.userData.angularSpeed = state.vergeAngularSpeed;
    crownWheel.userData.angularSpeed = state.wheelAngularSpeed;
    crownShaft.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = {
      freeDrop: state.freeDropState,
      leftPalletToCrownTooth: state.activePallet === 'left'
        ? state.contact : null,
      rightPalletToCrownTooth: state.activePallet === 'right'
        ? state.contact : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(6.2, -8.1, 6.9));
}

function circleRing(radius, count = 96) {
  const points = Array.from({ length: count }, (_, i) => [
    radius * Math.cos(i * FULL_TURN / count),
    radius * Math.sin(i * FULL_TURN / count),
  ]);
  return [...points, points[0]];
}

function sixPointAnchorEscapement(movement) {
  // Brown draws a six-point star (the catalogue title's "seven" is not in
  // the plate). Star D and the anchor carrying B and C are one plane of
  // plain extrusions; see six-point-anchor-238.js for the working edges and
  // the contact search behind the baked wheel motion.
  const root = new THREE.Group();
  const toothCount = ANCHOR_238.teeth;
  const toothPitch = FULL_TURN / toothCount;
  const cyclePeriod = 6;
  const plateDepth = 0.24;
  const pivot = new THREE.Vector2(...ANCHOR_238.pivotA);
  const star = starOutline238(12);
  const anchor = anchorOutline238(16);
  const wheelBore = 0.089;
  const pivotBore = 0.094;

  const wheelMaterial = matte(PALETTE.driven, { metalness: 0.12, roughness: 0.62 });
  const anchorMaterial = matte(PALETTE.driver, { metalness: 0.11, roughness: 0.63 });
  const inkMaterial = matte(PALETTE.ink, { metalness: 0.22, roughness: 0.49 });

  const escapeWheel = new THREE.Group();
  const rotor = new THREE.Group();
  escapeWheel.add(rotor);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.rotor = rotor;
  escapeWheel.userData.role = 'six-point-counterclockwise-star-wheel-D';
  escapeWheel.userData.teeth = toothCount;
  const wheelBody = new THREE.Mesh(plate(
    polygonClipping.difference([[[...star, star[0]]]], [[circleRing(wheelBore)]]),
    -plateDepth / 2,
    plateDepth / 2,
  ), wheelMaterial);
  wheelBody.userData.role = 'six-point-star-wheel-body-D';
  // p106: the bosses take a darker tint (x0.68) of their part, as on
  // 212/235/239/241, so they read as bosses rather than a crescent shadow.
  const bossTint = (material) => {
    const tinted = material.clone();
    tinted.color.multiplyScalar(0.68);
    return tinted;
  };
  // Their bores stand 0.004 back from the plates' so the two bore walls
  // (now different tints) do not coincide.
  const wheelHub = new THREE.Mesh(ring(wheelBore + 0.004, 0.15, -0.17, 0.17, 96), bossTint(wheelMaterial));
  wheelHub.userData.role = 'star-wheel-boss-D';
  rotor.add(wheelBody, wheelHub);
  root.add(escapeWheel);
  const escapeShaft = makeShaft({ axis: Z_AXIS, color: PALETTE.ink, length: 0.62, radius: 0.085 });
  escapeShaft.userData.role = 'escape-wheel-arbor-D';
  root.add(escapeShaft);

  const palletCarrier = new THREE.Group();
  palletCarrier.position.set(pivot.x, pivot.y, 0);
  palletCarrier.userData.axis = Z_AXIS.clone();
  palletCarrier.userData.role = 'one-piece-anchor-B-C-pivoted-at-A';
  const local = anchor.outline.map(([x, y]) => [x - pivot.x, y - pivot.y]);
  const palletBody = new THREE.Mesh(plate(
    polygonClipping.difference([[[...local, local[0]]]], [[circleRing(pivotBore)]]),
    -plateDepth / 2,
    plateDepth / 2,
  ), anchorMaterial);
  palletBody.userData.role = 'anchor-plate-with-step-B-and-hook-C';
  const palletHub = new THREE.Mesh(ring(pivotBore + 0.004, 0.3, -0.16, 0.16, 96), bossTint(anchorMaterial));
  palletHub.userData.role = 'anchor-boss-at-A';
  palletCarrier.add(palletBody, palletHub);
  root.add(palletCarrier);
  const palletShaft = makeShaft({ axis: Z_AXIS, color: PALETTE.ink, length: 0.58, radius: 0.09 });
  palletShaft.position.set(pivot.x, pivot.y, -0.03);
  palletShaft.userData.role = 'fixed-pallet-axis-A';
  const bearing = new THREE.Mesh(ring(pivotBore, 0.24, -0.29, -0.17, 96), inkMaterial);
  bearing.position.set(pivot.x, pivot.y, 0);
  bearing.userData.role = 'bored-fixed-journal-at-A';
  root.add(palletShaft, bearing);

  const table = ANCHOR_238_WHEEL.table;
  const steps = ANCHOR_238_WHEEL.steps;
  const wheelAngleAtCycle = (coordinate) => {
    const cycle = Math.floor(coordinate);
    const u = (coordinate - cycle) * steps;
    const i = Math.floor(u);
    const a = table[i];
    const b = i + 1 < steps ? table[i + 1] : table[0] + toothPitch;
    return cycle * toothPitch + a + (b - a) * (u - i);
  };
  const stateAtTime = (time) => {
    const coordinate = time / cyclePeriod;
    const phase = coordinate - Math.floor(coordinate);
    const h = 0.5 / steps;
    const wheelAngle = wheelAngleAtCycle(coordinate);
    const palletAngle = palletAngle238(phase);
    return {
      cyclePhase: phase,
      palletAngle,
      palletAngularSpeed: (palletAngle238(phase + h) - palletAngle238(phase - h)) / (2 * h * cyclePeriod),
      wheelAngle,
      wheelAngularSpeed: (wheelAngleAtCycle(coordinate + h) - wheelAngleAtCycle(coordinate - h)) / (2 * h * cyclePeriod),
    };
  };

  // Fit the view to the star and the anchor at both ends of its swing.
  const bounds = new THREE.Box3();
  for (const angle of [0, anchor.swing]) {
    for (const p of anchor.outline) {
      const q = rotate238(p, angle, ANCHOR_238.pivotA);
      bounds.expandByPoint(new THREE.Vector3(q[0], q[1], 0));
    }
  }
  bounds.expandByPoint(new THREE.Vector3(-ANCHOR_238.tipRadius, ANCHOR_238.tipRadius, 0));
  bounds.min.z = -0.3;
  bounds.max.z = 0.3;
  bounds.expandByScalar(0.05);

  root.userData.archetype = movement.archetype;
  root.userData.blocks = { escapeShaft, escapeWheel, palletBody, palletCarrier, palletHub, palletShaft, bearing, wheelBody, wheelHub };
  root.userData.cameraFitBounds = bounds;
  root.userData.animationTiming = { authoredCyclePeriod: cyclePeriod };
  root.userData.minimumDisplayCycleSeconds = cyclePeriod;
  root.userData.hideGround = true;
  root.userData.geometry = {
    cyclePeriod,
    palletPivot: pivot,
    plateDepth,
    rootRadius: ANCHOR_238.rootRadius,
    swing: anchor.swing,
    tipRadius: ANCHOR_238.tipRadius,
    toothCount,
    toothPitch,
  };
  root.userData.escapement238 = { anchor, star, overlaps: makeOverlapTest238(star, anchor.outline), wheel: ANCHOR_238_WHEEL };
  root.userData.stateAtTime = stateAtTime;
  root.userData.mechanism = 'one-piece anchor swings; step B and hook C alternately enter the roots of a six-point star wheel urged counter-clockwise';
  root.userData.transmission = {
    beatsPerCycle: 2,
    escapeWheelDirection: 'counterclockwise',
    outputAdvancePerOscillationInToothPitches: ANCHOR_238_WHEEL.closure / toothPitch,
    palletsShareRigidCarrier: true,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'Animation unavailable: fetched source has no inline add_model or mm_present program.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate238: {
      imageHeight: 525,
      imageWidth: 525,
      starPoints: toothCount,
      rasterWheelCenterD: new THREE.Vector2(214, 210),
      rasterPalletPivotA: new THREE.Vector2(264, 354),
      rasterCPoint: new THREE.Vector2(290, 185),
      note: 'Brown draws six star points; the catalogue title says seven.',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 61,
      edition: 21,
      illustrationPage: 60,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.reconstructionNote = 'Six-point star and one-piece anchor in one plane. B lies along the locked point\'s flank with its corner in the root (plate pose); C\'s hook nests in the opposite root at the other end of a 14° swing. The anchor\'s sinusoidal swing is prescribed (the pendulum); the urged wheel\'s motion comes from an offline polygon contact search (lock, slide, free drop, recoil). Friction, inertia of the anchor and impact bounce are not modelled.';

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.wheelAngle;
    setSpin(escapeShaft, state.wheelAngle);
    palletCarrier.rotation.z = state.palletAngle;
    escapeWheel.userData.angularSpeed = state.wheelAngularSpeed;
    escapeShaft.userData.angularSpeed = state.wheelAngularSpeed;
    palletCarrier.userData.angularSpeed = state.palletAngularSpeed;
    root.userData.kinematics = state;
  };
  update(0);
  root.traverse((object) => {
    if (object.isMesh) for (const material of [].concat(object.material)) material.fog = false;
  });
  return finish(root, update, new THREE.Vector3(0.8, -0.5, 18));
}

function classicWatchVergeEscapement(
  movement,
  {
    balanceAmplitudeDegrees = 35,
    catchAngleDegrees = 25,
    crownBodyDepth = 0.34,
    crownToothBackExponent = 1,
    crownToothHeight = 1,
    crownToothRakeFraction = 0,
    heightToRadiusRatio = null,
    palletIncludedAngleDegrees = 100,
    releaseAngleDegrees = 10,
    toothCount: crownToothCount = 13,
  } = {},
) {
  // Brown's plate is the traditional "vertical" watch escapement: a
  // horizontal balance C and its vertical staff stand at right angles to a
  // crown escape wheel.  The lower contrate wheel drives a pinion on the
  // crown-wheel arbor.  Reuse the already-solved crown/pallet surfaces from
  // Movement 234, but give them the watch orientation, a continuously moving
  // balance, real recoil, and the complete right-angle going-train pair.
  const base = vergeAndCrownWheelEscapement(movement, {
    bodyDepth: crownBodyDepth,
    heightToRadiusRatioOverride: heightToRadiusRatio,
    includeFrame: false,
    palletIncludedAngleDegrees,
    toothBackExponent: crownToothBackExponent,
    toothCount: crownToothCount,
    toothRakeFraction: crownToothRakeFraction,
    toothTipZ: crownToothHeight,
  });
  const root = base.root;
  const blocks = root.userData.blocks;
  const baseGeometry = { ...root.userData.geometry };
  const basePalletMetrics = root.userData.palletMetrics;
  const baseContactAt = root.userData.contactAt;

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterBalanceCenterC = new THREE.Vector2(267, 119);
  const sourceRasterBalanceOuterBounds = Object.freeze({
    bottom: 195,
    left: 18,
    right: 507,
    top: 37,
  });
  const sourceRasterBalanceHub = new THREE.Vector2(267, 116);
  const sourceRasterCrownWheelCenter = new THREE.Vector2(233, 281);
  const sourceRasterCrownWheelBounds = Object.freeze({
    bottom: 358,
    left: 198,
    right: 273,
    top: 201,
  });
  const sourceRasterBalanceStaffEndpoints = [
    new THREE.Vector2(266, 96),
    new THREE.Vector2(267, 420),
  ];
  const sourceRasterCrownArborEndpoints = [
    new THREE.Vector2(7, 282),
    new THREE.Vector2(257, 282),
  ];
  const sourceRasterEscapePinionCenter = new THREE.Vector2(97, 282);
  const sourceRasterTrainWheelCenter = new THREE.Vector2(119, 355);
  const sourceRasterDirectionArrow = new THREE.Vector2(187, 370);
  const sourceRasterLabelC = new THREE.Vector2(374, 136);
  const sourceScale = baseGeometry.bodyRadius / (
    (sourceRasterCrownWheelBounds.bottom
      - sourceRasterCrownWheelBounds.top) / 2
  );
  const sourcePointToPresentation = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterCrownWheelCenter.x) * sourceScale,
    (sourceRasterCrownWheelCenter.y - y) * sourceScale,
  );

  const toothCount = baseGeometry.toothCount;
  const toothPitch = baseGeometry.toothPitch;
  const halfToothPitch = toothPitch / 2;
  const palletHalfAngle = baseGeometry.palletHalfAngle;
  const contactAngleAtPalletAngle =
    root.userData.contactAngleAtPalletAngle;
  const contactAngleDerivative = root.userData.contactAngleDerivative;
  const contactAngleSecondDerivative =
    root.userData.contactAngleSecondDerivative;
  const balanceAmplitude = THREE.MathUtils.degToRad(balanceAmplitudeDegrees);
  const releaseAngle = THREE.MathUtils.degToRad(releaseAngleDegrees);
  const catchAngle = THREE.MathUtils.degToRad(catchAngleDegrees);
  const cyclePeriod = 4;
  const cyclesPerSecond = 1 / cyclePeriod;
  const phaseAngleRate = FULL_TURN;
  const firstReleasePhase = Math.acos(
    -releaseAngle / balanceAmplitude,
  ) / FULL_TURN;
  const firstCatchPhase = Math.acos(
    -catchAngle / balanceAmplitude,
  ) / FULL_TURN;
  const secondReleasePhase = 0.5 + firstReleasePhase;
  const secondCatchPhase = 0.5 + firstCatchPhase;

  const palletRootDistance = baseGeometry.heightDrop / Math.cos(
    palletHalfAngle - balanceAmplitude,
  );
  const palletReleaseDistance = baseGeometry.heightDrop / Math.cos(
    palletHalfAngle + releaseAngle,
  );
  const palletFaceSpan = palletReleaseDistance - palletRootDistance;
  const sourceWheelAngle = contactAngleAtPalletAngle(
    palletHalfAngle - balanceAmplitude,
  ) - baseGeometry.mountPhase;
  const contactAdvance = contactAngleAtPalletAngle(
    palletHalfAngle + releaseAngle,
  ) - contactAngleAtPalletAngle(
    palletHalfAngle - catchAngle,
  );
  const dropAngle = halfToothPitch - contactAdvance;
  const recoilAngle = contactAngleAtPalletAngle(
    palletHalfAngle - catchAngle,
  ) - contactAngleAtPalletAngle(
    palletHalfAngle - balanceAmplitude,
  );

  // Replace the long rectangular demonstration spindle with the cylindrical
  // balance staff actually shown in the watch plate.  The hidden originals
  // remain attached so normal model disposal still releases their resources.
  blocks.verge.traverse((object) => {
    if (
      object.userData.role === 'oscillating-spindle-S'
      || object.userData.role === 'verge-end-journal'
      || object.userData.role === 'verge-rotation-witness'
    ) object.visible = false;
  });
  const staffLength = 10;
  const staffCenter = 0.35;
  const balanceStaff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, staffLength, 28),
    matte(PALETTE.ink, { metalness: 0.28, roughness: 0.44 }),
  );
  balanceStaff.rotation.z = Math.PI / 2;
  balanceStaff.position.x = staffCenter;
  balanceStaff.userData.axis = X_AXIS.clone();
  balanceStaff.userData.role = 'vertical-balance-staff';
  blocks.verge.add(balanceStaff);

  // The source watch pallets terminate well before the much larger balance
  // reaches its extrema.  Trim both rendered working faces to those solved
  // release points; the short section before each extremum is the recoil.
  for (const pallet of [blocks.rightPallet, blocks.leftPallet]) {
    pallet.neck.scale.z = palletRootDistance
      / baseGeometry.palletRootDistance;
    pallet.neck.position.z = -palletRootDistance / 2;
    pallet.face.scale.z = palletFaceSpan / baseGeometry.palletFaceSpan;
    pallet.face.position.z = -(
      palletRootDistance + palletReleaseDistance
    ) / 2;
    pallet.tipEdge.position.z = -palletReleaseDistance + 0.02;
  }

  const balanceRadius = 5.6;
  const balanceCenterOnStaff = 5.3;
  const balanceDepth = 0.18;
  const balanceWheel = new THREE.Group();
  balanceWheel.position.x = balanceCenterOnStaff;
  balanceWheel.rotation.y = Math.PI / 2;
  balanceWheel.userData.axis = Z_AXIS.clone();
  balanceWheel.userData.role = 'three-spoke-balance-wheel-C';
  const balanceMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.6,
  });
  const balanceDarkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const balanceRim = new THREE.Mesh(
    new THREE.TorusGeometry(balanceRadius, 0.18, 14, 120),
    balanceMaterial,
  );
  balanceRim.userData.role = 'balance-C-rim';
  balanceWheel.add(balanceRim);
  const balanceHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.42, 36),
    balanceDarkMaterial,
  );
  balanceHub.rotation.x = Math.PI / 2;
  balanceHub.userData.role = 'balance-C-hub';
  balanceWheel.add(balanceHub);
  const balanceSpokes = [];
  for (let index = 0; index < 3; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(balanceRadius * 0.91, 0.15, balanceDepth),
      balanceMaterial,
    );
    const angle = index * FULL_TURN / 3;
    spoke.position.set(
      Math.cos(angle) * balanceRadius * 0.455,
      Math.sin(angle) * balanceRadius * 0.455,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.index = index;
    spoke.userData.role = 'balance-C-spoke';
    balanceSpokes.push(spoke);
    balanceWheel.add(spoke);
  }
  const balanceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.42, 0.055),
    matte(PALETTE.white, { roughness: 0.44 }),
  );
  balanceIndex.position.set(balanceRadius, 0, 0.04);
  balanceIndex.userData.role = 'balance-C-white-rim-index';
  balanceWheel.add(balanceIndex);
  blocks.verge.add(balanceWheel);

  // Brown draws the crown wheel nearly edge-on, but the companion period
  // diagram confirms an open spoked wheel.  Remove the opaque construction
  // disk used by Movement 234 so both alternating pallets remain inspectable.
  blocks.crownWheel.userData.body.visible = false;
  const crownOpenRim = new THREE.Mesh(
    new THREE.TorusGeometry(blocks.crownWheel.userData.toothBandRadius, 0.13, 12, 96),
    matte(PALETTE.driven, { metalness: 0.12, roughness: 0.6 }),
  );
  crownOpenRim.position.z = baseGeometry.toothBaseZ
    - baseGeometry.bodyDepth * 0.42;
  crownOpenRim.userData.role = 'open-crown-wheel-rim';
  blocks.crownWheel.userData.rotor.add(crownOpenRim);
  const crownSpokes = [];
  for (let index = 0; index < 4; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        blocks.crownWheel.userData.toothBandRadius * 2,
        0.14,
        0.13,
      ),
      matte(PALETTE.driven, { metalness: 0.12, roughness: 0.6 }),
    );
    spoke.rotation.z = index * Math.PI / 2;
    spoke.position.z = crownOpenRim.position.z;
    spoke.userData.index = index;
    spoke.userData.role = 'open-crown-wheel-spoke';
    crownSpokes.push(spoke);
    blocks.crownWheel.userData.rotor.add(spoke);
  }

  const pinionTeeth = 8;
  const trainTeeth = 32;
  const gearModule = 0.1375;
  const pinionPitchRadius = pinionTeeth * gearModule / 2;
  const trainPitchRadius = trainTeeth * gearModule / 2;
  const pinionAxialCoordinate = -2.25;
  const escapePinion = makeGear({
    axis: Z_AXIS,
    color: PALETTE.accent,
    depth: 0.34,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
    toothHeight: gearModule * 0.92,
  });
  escapePinion.position.z = pinionAxialCoordinate;
  escapePinion.userData.role = 'coaxial-eight-leaf-escape-pinion';
  root.add(escapePinion);

  const trainWheel = new THREE.Group();
  const trainRotor = new THREE.Group();
  trainWheel.add(trainRotor);
  trainWheel.quaternion.setFromUnitVectors(Z_AXIS, X_AXIS);
  trainWheel.position.set(
    -0.68,
    0,
    pinionAxialCoordinate - trainPitchRadius,
  );
  trainWheel.userData.axis = X_AXIS.clone();
  trainWheel.userData.rotor = trainRotor;
  trainWheel.userData.role = 'thirty-two-tooth-contrate-train-wheel';
  const trainMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const trainDarkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const trainRim = new THREE.Mesh(
    new THREE.TorusGeometry(trainPitchRadius * 0.94, 0.12, 12, 96),
    trainMaterial,
  );
  trainRim.position.z = -0.08;
  trainRim.userData.role = 'contrate-wheel-rim';
  trainRotor.add(trainRim);
  const trainHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.34, 32),
    trainDarkMaterial,
  );
  trainHub.rotation.x = Math.PI / 2;
  trainHub.position.z = -0.08;
  trainHub.userData.role = 'contrate-wheel-hub';
  trainRotor.add(trainHub);
  const trainSpokes = [];
  for (let index = 0; index < 4; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(trainPitchRadius * 1.55, 0.13, 0.14),
      trainDarkMaterial,
    );
    spoke.rotation.z = index * Math.PI / 2;
    spoke.position.z = -0.08;
    spoke.userData.index = index;
    spoke.userData.role = 'contrate-wheel-spoke';
    trainSpokes.push(spoke);
    trainRotor.add(spoke);
  }
  const trainTeethMeshes = [];
  for (let index = 0; index < trainTeeth; index += 1) {
    const angle = index * FULL_TURN / trainTeeth;
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(
        gearModule * 0.92,
        gearModule * 0.56,
        0.30,
      ),
      trainMaterial,
    );
    tooth.position.set(
      Math.cos(angle) * trainPitchRadius,
      Math.sin(angle) * trainPitchRadius,
      0.10,
    );
    tooth.rotation.z = angle;
    tooth.userData.index = index;
    tooth.userData.role = 'axial-contrate-train-tooth';
    trainTeethMeshes.push(tooth);
    trainRotor.add(tooth);
  }
  const trainIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.34, 0.05),
    matte(PALETTE.white, { roughness: 0.44 }),
  );
  trainIndex.position.set(trainPitchRadius * 0.82, 0, 0.29);
  trainIndex.userData.role = 'contrate-wheel-white-index';
  trainRotor.add(trainIndex);
  root.add(trainWheel);

  const trainShaft = makeShaft({
    axis: X_AXIS,
    length: 2.1,
    radius: 0.11,
  });
  trainShaft.position.copy(trainWheel.position);
  trainShaft.userData.role = 'perpendicular-train-wheel-arbor';
  root.add(trainShaft);

  const trainContactPoint = new THREE.Vector3(
    -pinionPitchRadius,
    0,
    pinionAxialCoordinate,
  );
  const trainContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 12),
    matte(PALETTE.white, { roughness: 0.42 }),
  );
  trainContactMarker.position.copy(trainContactPoint);
  trainContactMarker.userData.role =
    'fixed-contrate-to-escape-pinion-contact';
  root.add(trainContactMarker);

  const balanceAtPhase = (cyclePhase) => {
    const phaseAngle = FULL_TURN * cyclePhase;
    return {
      acceleration: balanceAmplitude * phaseAngleRate ** 2
        * Math.cos(phaseAngle),
      angle: -balanceAmplitude * Math.cos(phaseAngle),
      speed: balanceAmplitude * phaseAngleRate * Math.sin(phaseAngle),
    };
  };

  const contactWheelState = (side, balance, wheelBase) => {
    const palletAngle = side === 'right'
      ? palletHalfAngle + balance.angle
      : palletHalfAngle - balance.angle;
    const firstDerivative = contactAngleDerivative(palletAngle);
    const secondDerivative = contactAngleSecondDerivative(palletAngle);
    const sign = side === 'right' ? 1 : -1;
    return {
      acceleration: secondDerivative * balance.speed ** 2
        + sign * firstDerivative * balance.acceleration,
      angle: wheelBase + contactAngleAtPalletAngle(palletAngle)
        - baseGeometry.mountPhase,
      speed: sign * firstDerivative * balance.speed,
    };
  };

  const quinticDrop = ({
    cyclePhase,
    endAngle,
    endPhase,
    startState,
    startPhase,
  }) => {
    const span = endPhase - startPhase;
    const u = THREE.MathUtils.clamp(
      (cyclePhase - startPhase) / span,
      0,
      1,
    );
    const c0 = startState.angle;
    const c1 = startState.speed * span;
    const c2 = startState.acceleration * span ** 2 / 2;
    const positionResidual = endAngle - c0 - c1 - c2;
    const velocityResidual = -c1 - 2 * c2;
    const accelerationResidual = -2 * c2;
    const c3 = 10 * positionResidual - 4 * velocityResidual
      + accelerationResidual / 2;
    const c4 = -15 * positionResidual + 7 * velocityResidual
      - accelerationResidual;
    const c5 = 6 * positionResidual - 3 * velocityResidual
      + accelerationResidual / 2;
    const u2 = u ** 2;
    const u3 = u ** 3;
    const u4 = u ** 4;
    const u5 = u ** 5;
    const angle = c0 + c1 * u + c2 * u2 + c3 * u3
      + c4 * u4 + c5 * u5;
    const speed = (
      c1 + 2 * c2 * u + 3 * c3 * u2 + 4 * c4 * u3
      + 5 * c5 * u4
    ) / span;
    const acceleration = (
      2 * c2 + 6 * c3 * u + 12 * c4 * u2 + 20 * c5 * u3
    ) / span ** 2;
    return { acceleration, angle, progress: u, speed };
  };

  const palletMetrics = (side, toothIndex, balanceAngle, wheelAngle) => {
    const metrics = basePalletMetrics(
      side,
      toothIndex,
      balanceAngle,
      wheelAngle,
    );
    return {
      ...metrics,
      contactCoordinate: (
        metrics.longitudinalDistance - palletRootDistance
      ) / palletFaceSpan,
    };
  };

  const contactAt = ({
    balanceAngle,
    balanceAngularSpeed,
    side,
    toothIndex,
    wheelAngle,
    wheelAngularSpeed,
  }) => {
    const contact = baseContactAt({
      side,
      toothIndex,
      vergeAngle: balanceAngle,
      vergeAngularSpeed: balanceAngularSpeed,
      wheelAngle,
      wheelAngularSpeed,
    });
    return {
      ...contact,
      contactCoordinate: (
        contact.longitudinalDistance - palletRootDistance
      ) / palletFaceSpan,
    };
  };

  const trainContactAt = ({
    pinionAngularSpeed,
    trainWheelAngularSpeed,
  }) => {
    const pinionRadiusVector = new THREE.Vector3(
      -pinionPitchRadius,
      0,
      0,
    );
    const trainRadiusVector = new THREE.Vector3(
      0,
      0,
      trainPitchRadius,
    );
    const pinionVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(pinionAngularSpeed),
      pinionRadiusVector,
    );
    const trainVelocity = new THREE.Vector3().crossVectors(
      X_AXIS.clone().multiplyScalar(trainWheelAngularSpeed),
      trainRadiusVector,
    );
    return {
      contactPoint: trainContactPoint.clone(),
      pinionRadiusVector,
      pinionVelocity,
      surfaceVelocityError: pinionVelocity.clone().sub(trainVelocity),
      trainRadiusVector,
      trainVelocity,
    };
  };

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const balance = balanceAtPhase(cyclePhase);
    const initialRightIndex = positiveModulo(-cycleIndex, toothCount);
    const leftIndex = positiveModulo(
      initialRightIndex + (toothCount - 1) / 2,
      toothCount,
    );
    const finalRightIndex = positiveModulo(
      initialRightIndex - 1,
      toothCount,
    );
    const cycleWheelBase = cycleIndex * toothPitch;

    let activePallet = 'right';
    let activeToothIndex = initialRightIndex;
    let dropProgress = null;
    let escapingPallet = null;
    let escapingToothIndex = null;
    let approachingPallet = null;
    let approachingToothIndex = null;
    let freeDrop = false;
    let stage = balance.speed < 0
      ? 'right-pallet-recoil-before-lower-extreme'
      : 'right-pallet-direct-impulse-after-lower-extreme';
    let wheel = contactWheelState(
      'right',
      balance,
      cycleWheelBase,
    );

    if (
      cyclePhase >= firstReleasePhase
      && cyclePhase < firstCatchPhase
    ) {
      activePallet = null;
      activeToothIndex = null;
      approachingPallet = 'left';
      approachingToothIndex = leftIndex;
      escapingPallet = 'right';
      escapingToothIndex = initialRightIndex;
      freeDrop = true;
      const releaseBalance = balanceAtPhase(firstReleasePhase);
      const startState = contactWheelState(
        'right',
        releaseBalance,
        cycleWheelBase,
      );
      const catchBalance = balanceAtPhase(firstCatchPhase);
      const endState = contactWheelState(
        'left',
        catchBalance,
        cycleWheelBase + halfToothPitch,
      );
      wheel = quinticDrop({
        cyclePhase,
        endAngle: endState.angle,
        endPhase: firstCatchPhase,
        startPhase: firstReleasePhase,
        startState,
      });
      dropProgress = wheel.progress;
      stage = 'right-tooth-releases-and-crown-wheel-drops-to-left';
    } else if (
      cyclePhase >= firstCatchPhase
      && cyclePhase < secondReleasePhase
    ) {
      activePallet = 'left';
      activeToothIndex = leftIndex;
      wheel = contactWheelState(
        'left',
        balance,
        cycleWheelBase + halfToothPitch,
      );
      stage = balance.speed > 0
        ? 'left-pallet-recoil-before-upper-extreme'
        : 'left-pallet-direct-impulse-after-upper-extreme';
    } else if (
      cyclePhase >= secondReleasePhase
      && cyclePhase < secondCatchPhase
    ) {
      activePallet = null;
      activeToothIndex = null;
      approachingPallet = 'right';
      approachingToothIndex = finalRightIndex;
      escapingPallet = 'left';
      escapingToothIndex = leftIndex;
      freeDrop = true;
      const releaseBalance = balanceAtPhase(secondReleasePhase);
      const startState = contactWheelState(
        'left',
        releaseBalance,
        cycleWheelBase + halfToothPitch,
      );
      const catchBalance = balanceAtPhase(secondCatchPhase);
      const endState = contactWheelState(
        'right',
        catchBalance,
        cycleWheelBase + toothPitch,
      );
      wheel = quinticDrop({
        cyclePhase,
        endAngle: endState.angle,
        endPhase: secondCatchPhase,
        startPhase: secondReleasePhase,
        startState,
      });
      dropProgress = wheel.progress;
      stage = 'left-tooth-releases-and-crown-wheel-drops-to-right';
    } else if (cyclePhase >= secondCatchPhase) {
      activePallet = 'right';
      activeToothIndex = finalRightIndex;
      wheel = contactWheelState(
        'right',
        balance,
        cycleWheelBase + toothPitch,
      );
      stage = 'right-pallet-recoil-before-lower-extreme';
    }

    const balanceAngularSpeed = balance.speed * cyclesPerSecond;
    const balanceAngularAcceleration = balance.acceleration
      * cyclesPerSecond ** 2;
    const wheelAngularSpeed = wheel.speed * cyclesPerSecond;
    const wheelAngularAcceleration = wheel.acceleration
      * cyclesPerSecond ** 2;
    const trainWheelAngle = wheel.angle
      * pinionPitchRadius / trainPitchRadius;
    const trainWheelAngularSpeed = wheelAngularSpeed
      * pinionPitchRadius / trainPitchRadius;
    const trainWheelAngularAcceleration = wheelAngularAcceleration
      * pinionPitchRadius / trainPitchRadius;
    const contact = activePallet === null ? null : contactAt({
      balanceAngle: balance.angle,
      balanceAngularSpeed,
      side: activePallet,
      toothIndex: activeToothIndex,
      wheelAngle: wheel.angle,
      wheelAngularSpeed,
    });

    let freeDropState = null;
    if (freeDrop) {
      const escaping = palletMetrics(
        escapingPallet,
        escapingToothIndex,
        balance.angle,
        wheel.angle,
      );
      const approaching = palletMetrics(
        approachingPallet,
        approachingToothIndex,
        balance.angle,
        wheel.angle,
      );
      freeDropState = {
        approaching,
        escaping,
        progress: dropProgress,
      };
    }

    return {
      activePallet,
      activeToothIndex,
      approachingPallet,
      approachingToothIndex,
      balanceAngle: balance.angle,
      balanceAngularAcceleration,
      balanceAngularSpeed,
      contact,
      crownWheelAngle: wheel.angle,
      crownWheelAngularAcceleration: wheelAngularAcceleration,
      crownWheelAngularSpeed: wheelAngularSpeed,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      directImpulse: activePallet !== null && wheelAngularSpeed > 1e-12,
      dropProgress,
      escapingPallet,
      escapingToothIndex,
      freeDrop,
      freeDropState,
      recoil: activePallet !== null && wheelAngularSpeed < -1e-12,
      sourcePose: cyclePhase === 0,
      stage,
      teethAdvanced: (wheel.angle - sourceWheelAngle) / toothPitch,
      trainContact: trainContactAt({
        pinionAngularSpeed: wheelAngularSpeed,
        trainWheelAngularSpeed,
      }),
      trainWheelAngle,
      trainWheelAngularAcceleration,
      trainWheelAngularSpeed,
      vergeAngle: balance.angle,
      vergeAngularAcceleration: balanceAngularAcceleration,
      vergeAngularSpeed: balanceAngularSpeed,
      wheelAngle: wheel.angle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond,
  );

  // Rotate the tablet coordinates into a watch-like world orientation:
  // local crown Z -> world X, local verge X -> world Y, and local Y -> world Z.
  root.quaternion.setFromAxisAngle(
    new THREE.Vector3(1, 1, 1).normalize(),
    FULL_TURN / 3,
  );
  const displayScale = 0.55;
  root.scale.setScalar(displayScale);
  const localAxisToWorld = (axis) => axis.clone().applyQuaternion(
    root.quaternion,
  );
  blocks.crownWheel.userData.worldAxis = localAxisToWorld(Z_AXIS);
  blocks.crownShaft.userData.worldAxis = localAxisToWorld(Z_AXIS);
  blocks.verge.userData.worldAxis = localAxisToWorld(X_AXIS);
  balanceWheel.userData.worldAxis = localAxisToWorld(X_AXIS);
  escapePinion.userData.worldAxis = localAxisToWorld(Z_AXIS);
  trainWheel.userData.worldAxis = localAxisToWorld(X_AXIS);
  trainShaft.userData.worldAxis = localAxisToWorld(X_AXIS);

  root.userData.archetype =
    'vertical-verge-watch-escapement-with-balance-and-contrate-train';
  root.userData.blocks = {
    balanceHub,
    balanceIndex,
    balanceRim,
    balanceSpokes,
    balanceStaff,
    balanceWheel,
    crownShaft: blocks.crownShaft,
    crownOpenRim,
    crownSpokes,
    crownWheel: blocks.crownWheel,
    escapePinion,
    leftContactMarker: blocks.leftContactMarker,
    leftPallet: blocks.leftPallet,
    rightContactMarker: blocks.rightContactMarker,
    rightPallet: blocks.rightPallet,
    trainContactMarker,
    trainHub,
    trainIndex,
    trainRim,
    trainShaft,
    trainSpokes,
    trainTeeth: trainTeethMeshes,
    trainWheel,
    verge: blocks.verge,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.91, -2.67, -3.33),
    new THREE.Vector3(3.88, 3.11, 3.33),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    firstFreeDropMidpoint: cyclePeriod * (
      firstReleasePhase + firstCatchPhase
    ) / 2,
    leftImpulseMidpoint: cyclePeriod * 0.66,
    leftRecoilMidpoint: cyclePeriod * (
      firstCatchPhase + 0.5
    ) / 2,
    rightImpulseMidpoint: cyclePeriod * 0.16,
    rightRecoilMidpoint: cyclePeriod * (
      secondCatchPhase + 1
    ) / 2,
    secondFreeDropMidpoint: cyclePeriod * (
      secondReleasePhase + secondCatchPhase
    ) / 2,
    sourcePose: 0,
  };
  root.userData.contactAt = contactAt;
  root.userData.geometry = {
    ...baseGeometry,
    balanceAmplitude,
    balanceCenterOnStaff,
    balanceDepth,
    balanceRadius,
    catchAngle,
    contactAdvance,
    cyclePeriod,
    cyclesPerSecond,
    dropAngle,
    displayScale,
    firstCatchPhase,
    firstReleasePhase,
    gearModule,
    palletFaceSpan,
    palletReleaseDistance,
    palletRootDistance,
    pinionAxialCoordinate,
    pinionPitchRadius,
    pinionTeeth,
    recoilAngle,
    releaseAngle,
    secondCatchPhase,
    secondReleasePhase,
    sourceScale,
    sourceWheelAngle,
    staffCenter,
    staffLength,
    trainPitchRadius,
    trainTeeth,
    vergeAmplitude: balanceAmplitude,
  };
  root.userData.mechanism =
    'one horizontal three-spoke balance C and vertical staff carrying two angular verge pallets alternately recoil and release one thirteen-tooth perpendicular crown wheel; its coaxial eight-leaf pinion remains in exact right-angle mesh with one thirty-two-tooth contrate train wheel';
  root.userData.palletMetrics = palletMetrics;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 298 page marks Animated unavailable and serves only the original engraving.',
    referenceScope: 'Brown’s balance C, vertical verge, crown wheel, perpendicular train wheel and upward crown-wheel arrow; the continuous recoil/contact law is reconstructed from period verge descriptions.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToPresentation = sourcePointToPresentation;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    periodReference: {
      description: 'The old vertical watch escapement adapts the original crown-wheel clock escapement to a watch balance; early watches used a crown wheel and pallets, later adding a balance wheel and hair spring.',
      publicationYear: 1911,
      section: 'Watch Escapements',
      title: 'Encyclopaedia Britannica, 11th edition: Watch',
      url: 'https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Watch',
    },
    plate298: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one horizontal balance wheel C on one vertical two-pallet verge; one perpendicular axial-tooth crown wheel and coaxial pinion; one orthogonal train wheel',
      measurementUncertaintyPixels: 8,
      modeledCrownToothCount: toothCount,
      officialAnimationAvailable: false,
      rasterBalanceCenterC: sourceRasterBalanceCenterC,
      rasterBalanceHub: sourceRasterBalanceHub,
      rasterBalanceOuterBounds: sourceRasterBalanceOuterBounds,
      rasterBalanceStaffEndpoints: sourceRasterBalanceStaffEndpoints,
      rasterCrownArborEndpoints: sourceRasterCrownArborEndpoints,
      rasterCrownWheelBounds: sourceRasterCrownWheelBounds,
      rasterCrownWheelCenter: sourceRasterCrownWheelCenter,
      rasterDirectionArrow: sourceRasterDirectionArrow,
      rasterEscapePinionCenter: sourceRasterEscapePinionCenter,
      rasterLabelC: sourceRasterLabelC,
      rasterTrainWheelCenter: sourceRasterTrainWheelCenter,
      toothCountBasis: 'the partially occluded engraving is normalized to the historically required odd thirteen-tooth verge crown wheel',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.trainContactAt = trainContactAt;
  root.userData.transmission = {
    activePalletContactsAtOnce: 1,
    balanceDirection: 'alternating about the vertical staff',
    beatsPerOscillation: 2,
    contactAdvancePerBeatInToothPitches: contactAdvance / toothPitch,
    crownWheelDirection: 'counterclockwise on average with true recoil before each balance reversal',
    crownWheelTeeth: toothCount,
    dropPerBeatInToothPitches: dropAngle / toothPitch,
    escapePinionTeeth: pinionTeeth,
    oddCrownToothCountRequired: true,
    outputAdvancePerBeatInToothPitches: 0.5,
    outputAdvancePerOscillationInToothPitches: 1,
    palletIncludedAngleDegrees: THREE.MathUtils.radToDeg(
      baseGeometry.palletIncludedAngle,
    ),
    pinionToTrainAngularRatio: pinionPitchRadius / trainPitchRadius,
    topology: 'horizontal-balance-on-vertical-verge-perpendicular-to-crown-wheel-and-contrate-going-train',
    trainWheelTeeth: trainTeeth,
  };
  root.userData.cameraDistanceScale = 0.94;

  const update = (time) => {
    const state = stateAtTime(time);
    blocks.verge.rotation.x = state.balanceAngle;
    setSpin(blocks.crownWheel, state.crownWheelAngle);
    setSpin(blocks.crownShaft, state.crownWheelAngle);
    setSpin(escapePinion, state.crownWheelAngle);
    setSpin(trainWheel, state.trainWheelAngle);
    setSpin(trainShaft, state.trainWheelAngle);
    blocks.rightContactMarker.userData.active = state.activePallet === 'right';
    blocks.leftContactMarker.userData.active = state.activePallet === 'left';
    if (state.contact) {
      const marker = state.activePallet === 'right'
        ? blocks.rightContactMarker
        : blocks.leftContactMarker;
      marker.position.copy(state.contact.point);
    }
    blocks.verge.userData.angularSpeed = state.balanceAngularSpeed;
    balanceWheel.userData.angularSpeed = state.balanceAngularSpeed;
    blocks.crownWheel.userData.angularSpeed = state.crownWheelAngularSpeed;
    blocks.crownShaft.userData.angularSpeed = state.crownWheelAngularSpeed;
    escapePinion.userData.angularSpeed = state.crownWheelAngularSpeed;
    trainWheel.userData.angularSpeed = state.trainWheelAngularSpeed;
    trainShaft.userData.angularSpeed = state.trainWheelAngularSpeed;
    root.userData.contacts = {
      contrateTrainToEscapePinion: state.trainContact,
      freeDrop: state.freeDropState,
      leftPalletToCrownTooth: state.activePallet === 'left'
        ? state.contact : null,
      rightPalletToCrownTooth: state.activePallet === 'right'
        ? state.contact : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return finish(root, update, new THREE.Vector3(-10.8, 8.6, 12.8));
}

function sidewaysBalanceWheelCrownEscapement(movement) {
  // Brown's drawing is the early crown-wheel escapement turned on its side:
  // the crown arbor is vertical, the balance arbor points out of the plate,
  // and the two weighted arms vibrate in the plane of the engraving. Reuse
  // the continuous, contact-solved verge law from Movement 298, then replace
  // its watch train and circular balance with the exact arrangement in 302.
  // Brown's A and B hang from C in a V of about 57 degrees, each blade about
  // 0.74 long with C about 0.58 above the tooth tips, over fine teeth (about
  // ten across the band, so 21 round the crown). Fixing that height and
  // angle, a 9-degree release and 12-degree catch make each contact advance
  // about 0.84 of a half pitch (a 10-degree release lets the idle blade's
  // tip nick the escaped tooth's back), and a 22-degree balance swing keeps
  // the recoil to about a third of a half pitch. Brown's saw teeth are low
  // (about 0.6 of a pitch, a little under the band depth) with raked fronts
  // and slightly hollow backs, so the edge-on band reads as fine teeth rather
  // than square crenellations.
  const inherited = classicWatchVergeEscapement(movement, {
    balanceAmplitudeDegrees: 22,
    catchAngleDegrees: 12,
    crownBodyDepth: 0.42,
    crownToothBackExponent: 1.3,
    crownToothHeight: 0.4,
    crownToothRakeFraction: 0.18,
    heightToRadiusRatio: 0.264,
    palletIncludedAngleDegrees: 57,
    releaseAngleDegrees: 9,
    toothCount: 21,
  });
  const root = inherited.root;
  const inheritedBlocks = root.userData.blocks;
  const inheritedGeometry = { ...root.userData.geometry };
  const inheritedStateAtCycleCoordinate =
    root.userData.stateAtCycleCoordinate;

  const disposeDetached = (object) => {
    if (!object) return;
    object.parent?.remove(object);
    const geometries = new Set();
    const materials = new Set();
    object.traverse((child) => {
      if (child.geometry) geometries.add(child.geometry);
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => materials.add(material));
      } else if (child.material) {
        materials.add(child.material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  };

  disposeDetached(inheritedBlocks.balanceWheel);
  disposeDetached(inheritedBlocks.balanceStaff);
  disposeDetached(inheritedBlocks.trainContactMarker);
  disposeDetached(inheritedBlocks.trainShaft);
  disposeDetached(inheritedBlocks.trainWheel);
  disposeDetached(inheritedBlocks.crownOpenRim);
  inheritedBlocks.crownSpokes.forEach(disposeDetached);

  const crownWheel = inheritedBlocks.crownWheel;
  const crownShaft = inheritedBlocks.crownShaft;
  const verge = inheritedBlocks.verge;
  const drivePinion = inheritedBlocks.escapePinion;
  crownWheel.userData.body.visible = true;
  crownWheel.userData.body.userData.role =
    'horizontal-solid-crown-wheel-D-body';
  // The crown's white rotation witness is no longer exposed as
  // userData.indicator; Brown draws none, so hide it by role.
  crownWheel.userData.rotor.traverse((object) => {
    if (object.userData.role === 'crown-wheel-rotation-witness') {
      object.visible = false;
    }
  });
  // Brown's elevation shows no hub above the band: keep it inside the cup.
  crownWheel.userData.rotor.traverse((object) => {
    if (object.userData.role !== 'crown-wheel-hub') return;
    const height = 0.38;
    object.scale.y = height / object.geometry.parameters.height;
    object.position.z = crownWheel.userData.toothBaseZ - 0.02 - height / 2;
  });
  crownShaft.userData.role = 'vertical-crown-wheel-D-arbor';
  // Brown's arbor runs down from the underside of D only: it stops inside
  // the cup instead of rising between the teeth toward C.
  {
    const length = crownShaft.userData.length;
    const bottom = crownShaft.position.z - length / 2;
    const top = crownWheel.userData.toothBaseZ - 0.05;
    crownShaft.scale.z = (top - bottom) / length;
    crownShaft.position.z = (top + bottom) / 2;
  }
  drivePinion.position.z = -2.72;
  drivePinion.userData.role = 'coaxial-lower-drive-pinion';

  // Brown's A and B are plain blades radiating from the collar at C. Each
  // pallet is one brass blade: the carrier continues the working face at its
  // own width and thickness up to the arbor, replacing the narrower neck, and
  // there is no separate dark lip.
  const visualPalletThickness = 0.15;
  const palletCarriers = [];
  for (const pallet of [
    inheritedBlocks.leftPallet,
    inheritedBlocks.rightPallet,
  ]) {
    const bodySide = pallet.pallet.userData.bodySide;
    pallet.face.scale.y = visualPalletThickness
      / inheritedGeometry.palletThickness;
    pallet.face.position.y = bodySide * visualPalletThickness / 2;
    pallet.neck.visible = false;
    pallet.tipEdge.visible = false;
    const rootDistance = -pallet.neck.position.z * 2;
    const carrier = new THREE.Mesh(
      new THREE.BoxGeometry(
        inheritedGeometry.palletWidth,
        visualPalletThickness,
        rootDistance,
      ),
      pallet.face.material,
    );
    carrier.position.set(
      pallet.face.position.x,
      bodySide * visualPalletThickness / 2,
      -rootDistance / 2,
    );
    carrier.userData.role = `${pallet.pallet.userData.side}-pallet-carrier-arm`;
    pallet.pallet.add(carrier);
    palletCarriers.push(carrier);
  }

  const indexedTooth = crownWheel.userData.toothMeshes[0];
  indexedTooth.userData.role = 'indexed-axial-crown-tooth';
  const toothWitness = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 20, 14),
    matte(PALETTE.white, { roughness: 0.44 }),
  );
  // Seated on the wheel face just inside tooth 0, below every pallet path.
  const witnessRadius = crownWheel.userData.toothInnerRadius - 0.22;
  toothWitness.position.set(
    Math.cos(crownWheel.userData.mountPhase) * witnessRadius,
    Math.sin(crownWheel.userData.mountPhase) * witnessRadius,
    crownWheel.userData.toothBaseZ + 0.04,
  );
  toothWitness.userData.role = 'crown-wheel-rotation-witness';
  // Brown draws no witness marks; they stay attached for tests but hidden.
  toothWitness.visible = false;
  crownWheel.userData.rotor.add(toothWitness);

  const staffLength = 5.4;
  const balanceStaff = makeShaft({
    axis: X_AXIS,
    length: staffLength,
    radius: 0.11,
  });
  balanceStaff.userData.role = 'balance-C-and-pallet-arbor';
  verge.add(balanceStaff);

  const balanceAxialCoordinate = -2.7;
  const balanceMassDistance = 2.75;
  const balanceMassRadius = 0.78;
  // Brown draws A and B as a V hanging symmetrically from C, which is the
  // balance passing its centre with A driving: a quarter of the inherited
  // cycle. The arm is mounted so the weights still lie on Brown's diagonal.
  const sourceCycleOffset = 0.25;
  const sourceInheritedState = inheritedStateAtCycleCoordinate(
    sourceCycleOffset,
  );
  const sourceBalanceAngle = sourceInheritedState.balanceAngle;
  const sourceTeethAdvanced = sourceInheritedState.teethAdvanced;
  const sourcePoseArmAngle = THREE.MathUtils.degToRad(107.5);
  const balanceMountAngle = sourcePoseArmAngle
    - sourceBalanceAngle;
  const balanceArmDirection = new THREE.Vector3(
    0,
    Math.cos(balanceMountAngle),
    Math.sin(balanceMountAngle),
  );
  const balanceAssembly = new THREE.Group();
  balanceAssembly.position.x = balanceAxialCoordinate;
  balanceAssembly.userData.axis = X_AXIS.clone();
  balanceAssembly.userData.role = 'two-weight-balance-C';

  const firstMassCenter = balanceArmDirection.clone().multiplyScalar(
    balanceMassDistance,
  );
  const secondMassCenter = firstMassCenter.clone().multiplyScalar(-1);
  const balanceArm = makeBeam(firstMassCenter, secondMassCenter, {
    color: PALETTE.driver,
    depth: 0.14,
    thickness: 0.14,
  });
  balanceArm.userData.role = 'rigid-two-ended-balance-arm';
  balanceAssembly.add(balanceArm);

  const balanceMaterial = matte(PALETTE.driver, {
    metalness: 0.1,
    roughness: 0.62,
  });
  const balanceMasses = [firstMassCenter, secondMassCenter].map(
    (center, index) => {
      const mass = new THREE.Mesh(
        new THREE.SphereGeometry(balanceMassRadius, 40, 24),
        balanceMaterial,
      );
      mass.position.copy(center);
      mass.userData.index = index;
      mass.userData.role = index === 0
        ? 'upper-source-pose-balance-weight'
        : 'lower-source-pose-balance-weight';
      balanceAssembly.add(mass);
      return mass;
    },
  );

  // Brown's C is a small ring, so the hub behind it stays slim enough for
  // the V of A and B to read against the page.
  const balanceHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.32, 36),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.46 }),
  );
  balanceHub.rotation.z = Math.PI / 2;
  balanceHub.userData.role = 'balance-C-hub';
  balanceAssembly.add(balanceHub);

  const balanceWitness = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 20, 14),
    matte(PALETTE.white, { roughness: 0.44 }),
  );
  balanceWitness.position.copy(firstMassCenter).addScaledVector(
    balanceArmDirection,
    balanceMassRadius * 0.82,
  );
  balanceWitness.userData.role = 'balance-oscillation-witness';
  balanceWitness.visible = false;
  balanceAssembly.add(balanceWitness);
  verge.add(balanceAssembly);

  // A slim ring at C, so the pallet blades read beside it end-on. Its bore
  // (0.1) grips the 0.11 staff, so no sliver of the blade roots shows
  // between them.
  const staffCollars = [2.35].map((x, index) => {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.04, 12, 40),
      matte(PALETTE.frame, { metalness: 0.14, roughness: 0.68 }),
    );
    collar.rotation.y = Math.PI / 2;
    collar.position.x = x;
    collar.userData.index = index;
    collar.userData.role = 'front-balance-arbor-journal';
    verge.add(collar);
    return collar;
  });

  // Local X is the balance arbor, local Z is the crown arbor. This cyclic
  // rotation maps them respectively to world Z (toward the viewer) and world
  // Y (vertical), matching Brown's elevation.
  root.quaternion.setFromAxisAngle(
    new THREE.Vector3(1, 1, 1).normalize(),
    -FULL_TURN / 3,
  );
  root.scale.setScalar(1);
  const localAxisToWorld = (axis) => axis.clone().applyQuaternion(
    root.quaternion,
  );
  crownWheel.userData.worldAxis = localAxisToWorld(Z_AXIS);
  crownShaft.userData.worldAxis = localAxisToWorld(Z_AXIS);
  drivePinion.userData.worldAxis = localAxisToWorld(Z_AXIS);
  verge.userData.worldAxis = localAxisToWorld(X_AXIS);
  balanceStaff.userData.worldAxis = localAxisToWorld(X_AXIS);
  balanceAssembly.userData.worldAxis = localAxisToWorld(X_AXIS);

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterBalancePivotC = new THREE.Vector2(266, 201);
  const sourceRasterUpperWeightBounds = Object.freeze({
    bottom: 101,
    left: 176,
    right: 267,
    top: 7,
  });
  const sourceRasterLowerWeightBounds = Object.freeze({
    bottom: 419,
    left: 297,
    right: 392,
    top: 317,
  });
  const sourceRasterCrownWheelBounds = Object.freeze({
    bottom: 303,
    left: 97,
    right: 425,
    top: 235,
  });
  const sourceRasterCrownWheelCenter = new THREE.Vector2(261, 282);
  const sourceRasterCrownArborEndpoints = [
    new THREE.Vector2(264, 303),
    new THREE.Vector2(264, 501),
  ];
  const sourceRasterDrivePinionBounds = Object.freeze({
    bottom: 485,
    left: 238,
    right: 291,
    top: 442,
  });
  const sourceRasterDirectionArrow = Object.freeze({
    end: new THREE.Vector2(333, 335),
    start: new THREE.Vector2(203, 335),
  });
  const sourceScale = inheritedGeometry.bodyRadius / (
    (sourceRasterCrownWheelBounds.right
      - sourceRasterCrownWheelBounds.left) / 2
  );
  const sourcePointToPresentation = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterCrownWheelCenter.x) * sourceScale,
    (sourceRasterCrownWheelCenter.y - y) * sourceScale,
  );

  const cyclePeriod = inheritedGeometry.cyclePeriod;
  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const inheritedState = inheritedStateAtCycleCoordinate(
      cycleCoordinate + sourceCycleOffset,
    );
    const {
      trainContact: omittedTrainContact,
      trainWheelAngle: omittedTrainWheelAngle,
      trainWheelAngularAcceleration: omittedTrainWheelAngularAcceleration,
      trainWheelAngularSpeed: omittedTrainWheelAngularSpeed,
      ...state
    } = inheritedState;
    void omittedTrainContact;
    void omittedTrainWheelAngle;
    void omittedTrainWheelAngularAcceleration;
    void omittedTrainWheelAngularSpeed;
    return {
      ...state,
      balanceType: 'two-weight rigid balance',
      cycleCoordinate,
      cycleIndex: Math.floor(cycleCoordinate),
      cyclePhase: positiveModulo(cycleCoordinate, 1),
      drivePinionAngle: state.crownWheelAngle,
      drivePinionAngularAcceleration:
        state.crownWheelAngularAcceleration,
      drivePinionAngularSpeed: state.crownWheelAngularSpeed,
      sourcePose: Math.abs(positiveModulo(cycleCoordinate, 1)) < 1e-12,
      teethAdvanced: state.teethAdvanced - sourceTeethAdvanced,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time / cyclePeriod,
  );

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    balanceArm,
    balanceAssembly,
    balanceHub,
    balanceMasses,
    balanceStaff,
    balanceWitness,
    crownShaft,
    crownWheel,
    drivePinion,
    indexedTooth,
    leftContactMarker: inheritedBlocks.leftContactMarker,
    leftPallet: inheritedBlocks.leftPallet,
    palletCarriers,
    rightContactMarker: inheritedBlocks.rightContactMarker,
    rightPallet: inheritedBlocks.rightPallet,
    staffCollars,
    toothWitness,
    verge,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.55, -3.35, -3.35),
    new THREE.Vector3(3.55, 4.35, 3.35),
  );
  const timeFromInheritedPhase = (phase) => positiveModulo(
    phase - sourceCycleOffset,
    1,
  ) * cyclePeriod;
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    firstFreeDropMidpoint: timeFromInheritedPhase((
      inheritedGeometry.firstReleasePhase
      + inheritedGeometry.firstCatchPhase
    ) / 2),
    leftImpulseMidpoint: timeFromInheritedPhase(0.66),
    leftRecoilMidpoint: timeFromInheritedPhase((
      inheritedGeometry.firstCatchPhase + 0.5
    ) / 2),
    rightImpulseMidpoint: timeFromInheritedPhase(0.16),
    rightRecoilMidpoint: timeFromInheritedPhase((
      inheritedGeometry.secondCatchPhase + 1
    ) / 2),
    secondFreeDropMidpoint: timeFromInheritedPhase((
      inheritedGeometry.secondReleasePhase
      + inheritedGeometry.secondCatchPhase
    ) / 2),
    sourcePose: 0,
  };
  root.userData.geometry = {
    axialLayers: inheritedGeometry.axialLayers,
    balanceAmplitude: inheritedGeometry.balanceAmplitude,
    balanceAxialCoordinate,
    balanceMassDistance,
    balanceMassRadius,
    balanceMountAngle,
    bodyDepth: inheritedGeometry.bodyDepth,
    bodyRadius: inheritedGeometry.bodyRadius,
    catchAngle: inheritedGeometry.catchAngle,
    contactAdvance: inheritedGeometry.contactAdvance,
    contactRadius: inheritedGeometry.contactRadius,
    cyclePeriod,
    cyclesPerSecond: inheritedGeometry.cyclesPerSecond,
    dropAngle: inheritedGeometry.dropAngle,
    firstCatchPhase: inheritedGeometry.firstCatchPhase,
    firstReleasePhase: inheritedGeometry.firstReleasePhase,
    halfToothPitch: inheritedGeometry.toothPitch / 2,
    palletFaceSpan: inheritedGeometry.palletFaceSpan,
    palletHalfAngle: inheritedGeometry.palletHalfAngle,
    palletIncludedAngle: inheritedGeometry.palletIncludedAngle,
    palletReleaseDistance: inheritedGeometry.palletReleaseDistance,
    palletRootDistance: inheritedGeometry.palletRootDistance,
    recoilAngle: inheritedGeometry.recoilAngle,
    releaseAngle: inheritedGeometry.releaseAngle,
    secondCatchPhase: inheritedGeometry.secondCatchPhase,
    secondReleasePhase: inheritedGeometry.secondReleasePhase,
    sourceBalanceAngle,
    sourceCycleOffset,
    sourcePoseArmAngle,
    sourceScale,
    staffLength,
    toothCount: inheritedGeometry.toothCount,
    toothPitch: inheritedGeometry.toothPitch,
    toothTipZ: inheritedGeometry.toothTipZ,
    vergeAxisZ: inheritedGeometry.vergeAxisZ,
  };
  root.userData.mechanism =
    'one rigid two-weight balance C and its out-of-page arbor carry two pallets A and B, 57 degrees apart as Brown draws them, over opposite sides of one vertical-arbor twenty-one-tooth crown escape wheel D; each contact recoils before reversal, gives direct impulse after reversal, releases, and admits one finite half-pitch drop';
  root.userData.presentation =
    'front elevation of the crown wheel held sideways';
  root.userData.presentationView = 'front';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 302 page marks Animated unavailable and serves only Brown\'s original engraving.',
    referenceScope: 'Brown fixes the vertical crown arbor, edge-on horizontal crown wheel D, two pallets A and B on the out-of-page balance arbor C, two weighted balance arms, lower drive pinion, and rightward wheel direction.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToPresentation = sourcePointToPresentation;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    periodReference: {
      author: 'Edmund Beckett Denison',
      description: 'Figure 4 describes the crown-wheel escapement held sideways so its two balls form a balance. Pallets CA and CB are flat steel pieces about a right angle apart, one over the front and one over the back of the wheel. After the opposite tooth drops, continuing balance motion drives the wheel backward before the wheel returns the balance, producing true recoil.',
      figure: 'Figure 4',
      printedPage: 23,
      publicationYear: 1857,
      title: 'Clocks and Locks: From the Encyclopaedia Britannica, second edition',
      url: 'https://deriv.nls.uk/dcn23/1409/1507/140915072.23.pdf',
    },
    plate302: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one edge-on horizontal crown wheel D on a vertical arbor; one perpendicular balance arbor C carrying two front/back pallets A and B and a rigid pair of balance weights',
      measurementUncertaintyPixels: 8,
      modeledCrownToothCount: inheritedGeometry.toothCount,
      officialAnimationAvailable: false,
      rasterBalancePivotC: sourceRasterBalancePivotC,
      rasterCrownArborEndpoints: sourceRasterCrownArborEndpoints,
      rasterCrownWheelBounds: sourceRasterCrownWheelBounds,
      rasterCrownWheelCenter: sourceRasterCrownWheelCenter,
      rasterDirectionArrow: sourceRasterDirectionArrow,
      rasterDrivePinionBounds: sourceRasterDrivePinionBounds,
      rasterLowerWeightBounds: sourceRasterLowerWeightBounds,
      rasterUpperWeightBounds: sourceRasterUpperWeightBounds,
      toothCountBasis: 'a symmetric verge-and-crown escapement requires an odd tooth count; Brown draws about ten fine teeth across the edge-on band, so twenty-one round the crown',
    },
    primaryScan: {
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    activePalletContactsAtOnce: 1,
    balanceDirection: 'alternating about the out-of-page arbor C',
    balanceType: 'rigid two-weight balance',
    beatsPerOscillation: 2,
    contactAdvancePerBeatInToothPitches:
      inheritedGeometry.contactAdvance / inheritedGeometry.toothPitch,
    crownWheelDirection: 'rightward at the visible near tooth row on average, with true recoil before each balance reversal',
    crownWheelTeeth: inheritedGeometry.toothCount,
    dropPerBeatInToothPitches:
      inheritedGeometry.dropAngle / inheritedGeometry.toothPitch,
    oddCrownToothCountRequired: true,
    outputAdvancePerBeatInToothPitches: 0.5,
    outputAdvancePerOscillationInToothPitches: 1,
    palletIncludedAngleDegrees: THREE.MathUtils.radToDeg(
      inheritedGeometry.palletIncludedAngle,
    ),
    palletsShareBalanceArbor: true,
    pinionRigidlyCoaxialWithCrownWheel: true,
    recoil: true,
    topology: 'sideways-two-weight-balance-verge-perpendicular-to-one-horizontal-crown-wheel',
  };
  root.userData.cameraDistanceScale = 0.92;
  // Brown's 302 is a flat front elevation: a narrow field keeps the crown
  // edge-on as a band with saw teeth along its top instead of looking down
  // on its rim from the fitted target above it.
  root.userData.cameraFov = 12;

  const update = (time) => {
    const state = stateAtTime(time);
    verge.rotation.x = state.balanceAngle;
    setSpin(crownWheel, state.crownWheelAngle);
    setSpin(crownShaft, state.crownWheelAngle);
    setSpin(drivePinion, state.drivePinionAngle);
    inheritedBlocks.rightContactMarker.userData.active =
      state.activePallet === 'right';
    inheritedBlocks.leftContactMarker.userData.active =
      state.activePallet === 'left';
    if (state.contact) {
      const marker = state.activePallet === 'right'
        ? inheritedBlocks.rightContactMarker
        : inheritedBlocks.leftContactMarker;
      marker.position.copy(state.contact.point);
    }
    verge.userData.angularSpeed = state.balanceAngularSpeed;
    crownWheel.userData.angularSpeed = state.crownWheelAngularSpeed;
    crownShaft.userData.angularSpeed = state.crownWheelAngularSpeed;
    drivePinion.userData.angularSpeed = state.drivePinionAngularSpeed;
    balanceAssembly.userData.angularSpeed = state.balanceAngularSpeed;
    balanceStaff.userData.angularSpeed = state.balanceAngularSpeed;
    root.userData.contacts = {
      freeDrop: state.freeDropState,
      leftPalletToCrownTooth: state.activePallet === 'left'
        ? state.contact : null,
      rightPalletToCrownTooth: state.activePallet === 'right'
        ? state.contact : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  // Brown's 302 is a flat elevation with no ground line.
  root.userData.hideGround = true;
  markShadows(root);
  return finish(root, update, new THREE.Vector3(0, 0, 1));
}

function oldFashionedClockVergeEscapement(movement) {
  // Brown shows the clock form of the crown-wheel escapement nearly edge-on.
  // The two blades radiating from the verge journal measure about 106 degrees
  // apart in the plate, consistent with the roughly 100-degree pallet angle
  // of a verge-and-foliot clock.  Build the complete 3D mechanism so the
  // hidden depth relationship is explicit: the vertical verge and its
  // weighted foliot stand at right angles to the horizontal crown-wheel
  // arbor, and only one pallet can meet an axial crown tooth at a time.
  // Brown's teeth are about 0.55 of a pitch tall (0.6 here) with raked
  // leading faces: each tip overhangs its foot by about 0.37 pitch in the
  // plate (0.35 here) and the next tooth's concave back starts at that foot,
  // so the strip has no flat gaps. Brown's backs are gentle arcs (a power
  // law of about 1.6 fits the plate; 1.8 here). The pallets are plain
  // slender strips (0.12 thick against Brown's roughly 1:6) and end at the
  // release edge, where the tooth tip leaves them. Brown draws them about
  // 0.6-0.65 of a pitch long; a pallet of length L releases at cos(phi) =
  // h / L, with h the staff height above the tooth tips, and the half-pitch
  // advance per beat then fixes h for a given pallet angle. Opening the
  // pallets to 108 degrees (Brown's blades measure about 106) lets the staff
  // sit at 0.20 (0.19 pitch; Brown about 0.15) with 0.61-long pallets (0.58
  // pitch) that release 17 degrees past mid-swing and catch at 20.4 (2.0
  // degrees of drop); the pallets clear the gentler backs through the
  // 45-degree foliot swing. The wider angle brings the idle pallet down
  // closer to the approaching tooth's back, so the pallets are 0.34 wide
  // radially (the tooth depth, seen edge-on in Brown's view) rather than 0.5.
  const tuning = { h: 0.20, n: 1.8, amp: 45, rel: 17, cat: 20.4, included: 108, width: 0.34 };
  const base = vergeAndCrownWheelEscapement(movement, {
    flagPallets: true,
    heightToRadiusRatioOverride: tuning.h / 2.2,
    palletIncludedAngleDegrees: tuning.included,
    includeFrame: false,
    palletThickness: 0.12,
    palletWidth: tuning.width,
    toothBackExponent: tuning.n,
    toothRakeFraction: 0.35,
    toothTipZ: 0.6,
  });
  const root = base.root;
  const blocks = root.userData.blocks;
  const baseGeometry = { ...root.userData.geometry };
  const basePalletMetrics = root.userData.palletMetrics;
  const baseContactAt = root.userData.contactAt;

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterVergeJournal = new THREE.Vector2(293, 178);
  const sourceRasterLeftPalletTip = new THREE.Vector2(207, 319);
  const sourceRasterRightPalletTip = new THREE.Vector2(438, 218);
  const sourceRasterCrownBounds = Object.freeze({
    bottom: 395,
    left: 15,
    right: 511,
    top: 204,
  });
  const sourceRasterLeftCrownContact = new THREE.Vector2(108, 329);
  const sourceRasterRightCrownContact = new THREE.Vector2(337, 329);
  const sourceRasterLeftToothApex = new THREE.Vector2(191, 205);
  const sourceRasterRightToothApex = new THREE.Vector2(439, 218);
  const sourceLeftPalletVector = sourceRasterLeftPalletTip.clone().sub(
    sourceRasterVergeJournal,
  );
  const sourceRightPalletVector = sourceRasterRightPalletTip.clone().sub(
    sourceRasterVergeJournal,
  );
  const sourcePalletIncludedAngle = sourceLeftPalletVector.angleTo(
    sourceRightPalletVector,
  );
  const sourceScale = 5 / (
    sourceRasterCrownBounds.right - sourceRasterCrownBounds.left
  );
  const sourcePointToPresentation = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterVergeJournal.x) * sourceScale,
    (sourceRasterVergeJournal.y - y) * sourceScale,
  );

  const toothCount = baseGeometry.toothCount;
  const toothPitch = baseGeometry.toothPitch;
  const halfToothPitch = toothPitch / 2;
  const palletHalfAngle = baseGeometry.palletHalfAngle;
  const contactAngleAtPalletAngle =
    root.userData.contactAngleAtPalletAngle;
  const contactAngleDerivative = root.userData.contactAngleDerivative;
  const contactAngleSecondDerivative =
    root.userData.contactAngleSecondDerivative;
  const foliotAmplitude = THREE.MathUtils.degToRad(tuning.amp);
  const releaseAngle = THREE.MathUtils.degToRad(tuning.rel);
  const catchAngle = THREE.MathUtils.degToRad(tuning.cat);
  const cyclePeriod = 4;
  const cyclesPerSecond = 1 / cyclePeriod;
  const phaseAngleRate = FULL_TURN;
  const firstReleasePhase = Math.acos(
    -releaseAngle / foliotAmplitude,
  ) / FULL_TURN;
  const firstCatchPhase = Math.acos(
    -catchAngle / foliotAmplitude,
  ) / FULL_TURN;
  const secondReleasePhase = 0.5 + firstReleasePhase;
  const secondCatchPhase = 0.5 + firstCatchPhase;

  const palletRootDistance = baseGeometry.heightDrop / Math.cos(
    palletHalfAngle - foliotAmplitude,
  );
  const palletReleaseDistance = baseGeometry.heightDrop / Math.cos(
    palletHalfAngle + releaseAngle,
  );
  const palletFaceSpan = palletReleaseDistance - palletRootDistance;
  const sourceWheelAngle = contactAngleAtPalletAngle(
    palletHalfAngle - foliotAmplitude,
  ) - baseGeometry.mountPhase;
  const contactAdvance = contactAngleAtPalletAngle(
    palletHalfAngle + releaseAngle,
  ) - contactAngleAtPalletAngle(
    palletHalfAngle - catchAngle,
  );
  const dropAngle = halfToothPitch - contactAdvance;
  const recoilAngle = contactAngleAtPalletAngle(
    palletHalfAngle - catchAngle,
  ) - contactAngleAtPalletAngle(
    palletHalfAngle - foliotAmplitude,
  );

  blocks.verge.traverse((object) => {
    if (
      object.userData.role === 'oscillating-spindle-S'
      || object.userData.role === 'verge-end-journal'
      || object.userData.role === 'verge-rotation-witness'
    ) object.visible = false;
  });
  for (const pallet of [blocks.rightPallet, blocks.leftPallet]) {
    pallet.neck.scale.z = palletRootDistance
      / baseGeometry.palletRootDistance;
    pallet.neck.position.z = -palletRootDistance / 2;
    pallet.face.scale.z = palletFaceSpan / baseGeometry.palletFaceSpan;
    pallet.face.position.z = -(
      palletRootDistance + palletReleaseDistance
    ) / 2;
    pallet.tipEdge.position.z = -palletReleaseDistance + 0.02;
  }

  // The staff ends just outside the lower pallet in the journal Brown draws
  // end-on, and runs up past the upper pallet to the foliot.
  // Brown's end-on journal is a small ring (about 0.11 of the crown pitch
  // radius here) around a pivot circle about a third of its size, so the
  // pallet strips show nearly their full length beside it. The staff is a
  // slender rod ending in the collar, with only its pivot standing proud.
  // p106: the foliot is not displayed (Brown's crop), so the staff ends
  // just past the far pallet (world 1.37, local 2.24) instead of running
  // on another 1.5 past the crown's far rim.
  const vergeStaffBottom = -2.42;
  const vergeStaffTop = 2.32;
  const vergeStaffLength = vergeStaffTop - vergeStaffBottom;
  const vergeStaffCenter = (vergeStaffTop + vergeStaffBottom) / 2;
  const vergeStaff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, vergeStaffLength, 30),
    matte(PALETTE.ink, { metalness: 0.27, roughness: 0.45 }),
  );
  vergeStaff.rotation.z = Math.PI / 2;
  vergeStaff.position.x = vergeStaffCenter;
  vergeStaff.userData.axis = X_AXIS.clone();
  vergeStaff.userData.role = 'vertical-clock-verge-staff';
  blocks.verge.add(vergeStaff);
  const journalCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.12, 36),
    matte(PALETTE.driver, { metalness: 0.14, roughness: 0.57 }),
  );
  journalCollar.rotation.z = Math.PI / 2;
  journalCollar.position.x = vergeStaffCenter - vergeStaffLength / 2 + 0.03;
  journalCollar.userData.role = 'verge-journal-collar';
  blocks.verge.add(journalCollar);
  const journalPivot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.1, 20),
    matte(PALETTE.ink, { metalness: 0.27, roughness: 0.45 }),
  );
  journalPivot.rotation.z = Math.PI / 2;
  journalPivot.position.x = vergeStaffCenter - vergeStaffLength / 2 - 0.06;
  journalPivot.userData.role = 'verge-journal-pivot';
  blocks.verge.add(journalPivot);

  const foliotPositionOnStaff = 4.65;
  const foliotBarLength = 9.2;
  const foliotWeightOffset = 3.62;
  const foliot = new THREE.Group();
  foliot.position.x = foliotPositionOnStaff;
  foliot.userData.axis = X_AXIS.clone();
  foliot.userData.role = 'weighted-horizontal-foliot-regulator';
  const foliotMaterial = matte(PALETTE.driver, {
    metalness: 0.11,
    roughness: 0.62,
  });
  const foliotWeightMaterial = matte(PALETTE.brass, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const foliotBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, foliotBarLength, 0.18),
    foliotMaterial,
  );
  foliotBar.userData.role = 'foliot-crossbar';
  foliot.add(foliotBar);
  const foliotWeights = [-1, 1].map((side) => {
    const weight = new THREE.Group();
    weight.position.y = side * foliotWeightOffset;
    weight.userData.adjustmentCoordinate = side * foliotWeightOffset;
    weight.userData.role = side < 0
      ? 'left-adjustable-foliot-weight'
      : 'right-adjustable-foliot-weight';
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.82, 0.68),
      foliotWeightMaterial,
    );
    body.userData.role = `${side < 0 ? 'left' : 'right'}-foliot-weight-body`;
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.055, 10, 32),
      matte(PALETTE.ink, { metalness: 0.24, roughness: 0.47 }),
    );
    collar.rotation.x = Math.PI / 2;
    collar.userData.role = `${side < 0 ? 'left' : 'right'}-foliot-weight-collar`;
    weight.add(body, collar);
    foliot.add(weight);
    return weight;
  });
  const foliotHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.38, 34),
    matte(PALETTE.driver, { metalness: 0.14, roughness: 0.57 }),
  );
  foliotHub.rotation.z = Math.PI / 2;
  foliotHub.userData.role = 'foliot-to-verge-hub';
  foliot.add(foliotHub);
  const foliotIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.34, 0.08),
    matte(PALETTE.white, { roughness: 0.43 }),
  );
  foliotIndex.position.set(0.34, foliotWeightOffset, 0);
  foliotIndex.userData.role = 'white-foliot-motion-index';
  foliot.add(foliotIndex);
  blocks.verge.add(foliot);

  // Brown draws the rim as a solid hatched band under the teeth, so the
  // crown keeps its band; the open rim and crossing spokes of an iron clock
  // crown stay inside and under it.
  // Keep the crown hub inside the cup, below the teeth, so it does not stand
  // under the verge journal in the edge-on view.
  blocks.crownWheel.userData.rotor.traverse((object) => {
    if (object.userData.role !== 'crown-wheel-hub') return;
    // A short hub stays within the band's depth, so nothing hangs below
    // the band Brown draws.
    const height = object.geometry.parameters.height;
    const keptHeight = baseGeometry.bodyDepth - 0.06;
    object.scale.y = keptHeight / height;
    object.position.z = baseGeometry.toothBaseZ - 0.02 - keptHeight / 2;
  });
  // p106: Brown draws no floor inside the band; from below it read as a
  // solid black disc. The band is carried by the rim and two slim bars.
  const crownFloors = [];
  blocks.crownWheel.userData.rotor.traverse((object) => {
    if (object.userData.role === 'crown-wheel-floor') crownFloors.push(object);
  });
  for (const floor of crownFloors) {
    floor.removeFromParent();
    floor.geometry.dispose();
  }
  // Brown draws no arbor: only a stub inside the cup is kept.
  const crownShaftStub = 0.2;
  blocks.crownShaft.scale.z = crownShaftStub / blocks.crownShaft.userData.length;
  blocks.crownShaft.position.z = baseGeometry.toothBaseZ - 0.05
    - crownShaftStub / 2;
  const crownRim = new THREE.Mesh(
    new THREE.TorusGeometry(blocks.crownWheel.userData.toothBandRadius, 0.14, 12, 96),
    matte(PALETTE.driven, { metalness: 0.13, roughness: 0.6 }),
  );
  crownRim.position.z = baseGeometry.toothBaseZ
    - baseGeometry.bodyDepth * 0.44;
  crownRim.userData.role = 'open-clock-crown-wheel-rim';
  blocks.crownWheel.userData.rotor.add(crownRim);
  // p106: two crossed bars (four arms). Indices 2 and 3 duplicated 0 and 1
  // exactly (coincident faces); Brown draws no floor inside the band, so the
  // shared cup's floor disc is dropped and only these slim arms carry it.
  const crownSpokes = [];
  for (let index = 0; index < 2; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        blocks.crownWheel.userData.toothBandRadius * 2,
        0.14,
        0.13,
      ),
      matte(PALETTE.driven, { metalness: 0.13, roughness: 0.6 }),
    );
    spoke.rotation.z = index * Math.PI / 2;
    spoke.position.z = crownRim.position.z;
    spoke.userData.index = index;
    spoke.userData.role = 'open-clock-crown-wheel-spoke';
    crownSpokes.push(spoke);
    blocks.crownWheel.userData.rotor.add(spoke);
  }

  const foliotAtPhase = (cyclePhase) => {
    const phaseAngle = FULL_TURN * cyclePhase;
    return {
      acceleration: foliotAmplitude * phaseAngleRate ** 2
        * Math.cos(phaseAngle),
      angle: -foliotAmplitude * Math.cos(phaseAngle),
      speed: foliotAmplitude * phaseAngleRate * Math.sin(phaseAngle),
    };
  };

  const contactWheelState = (side, foliotState, wheelBase) => {
    const palletAngle = side === 'right'
      ? palletHalfAngle + foliotState.angle
      : palletHalfAngle - foliotState.angle;
    const firstDerivative = contactAngleDerivative(palletAngle);
    const secondDerivative = contactAngleSecondDerivative(palletAngle);
    const sign = side === 'right' ? 1 : -1;
    return {
      acceleration: secondDerivative * foliotState.speed ** 2
        + sign * firstDerivative * foliotState.acceleration,
      angle: wheelBase + contactAngleAtPalletAngle(palletAngle)
        - baseGeometry.mountPhase,
      speed: sign * firstDerivative * foliotState.speed,
    };
  };

  const quinticDrop = ({
    cyclePhase,
    endAngle,
    endPhase,
    startState,
    startPhase,
  }) => {
    const span = endPhase - startPhase;
    const u = THREE.MathUtils.clamp(
      (cyclePhase - startPhase) / span,
      0,
      1,
    );
    const c0 = startState.angle;
    const c1 = startState.speed * span;
    const c2 = startState.acceleration * span ** 2 / 2;
    const positionResidual = endAngle - c0 - c1 - c2;
    const velocityResidual = -c1 - 2 * c2;
    const accelerationResidual = -2 * c2;
    const c3 = 10 * positionResidual - 4 * velocityResidual
      + accelerationResidual / 2;
    const c4 = -15 * positionResidual + 7 * velocityResidual
      - accelerationResidual;
    const c5 = 6 * positionResidual - 3 * velocityResidual
      + accelerationResidual / 2;
    const u2 = u ** 2;
    const u3 = u ** 3;
    const u4 = u ** 4;
    const u5 = u ** 5;
    const angle = c0 + c1 * u + c2 * u2 + c3 * u3
      + c4 * u4 + c5 * u5;
    const speed = (
      c1 + 2 * c2 * u + 3 * c3 * u2 + 4 * c4 * u3
      + 5 * c5 * u4
    ) / span;
    const acceleration = (
      2 * c2 + 6 * c3 * u + 12 * c4 * u2 + 20 * c5 * u3
    ) / span ** 2;
    return { acceleration, angle, progress: u, speed };
  };

  const palletMetrics = (side, toothIndex, foliotAngle, wheelAngle) => {
    const metrics = basePalletMetrics(
      side,
      toothIndex,
      foliotAngle,
      wheelAngle,
    );
    return {
      ...metrics,
      contactCoordinate: (
        metrics.longitudinalDistance - palletRootDistance
      ) / palletFaceSpan,
    };
  };

  const contactAt = ({
    foliotAngle,
    foliotAngularSpeed,
    side,
    toothIndex,
    wheelAngle,
    wheelAngularSpeed,
  }) => {
    const contact = baseContactAt({
      side,
      toothIndex,
      vergeAngle: foliotAngle,
      vergeAngularSpeed: foliotAngularSpeed,
      wheelAngle,
      wheelAngularSpeed,
    });
    return {
      ...contact,
      contactCoordinate: (
        contact.longitudinalDistance - palletRootDistance
      ) / palletFaceSpan,
    };
  };

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const foliotState = foliotAtPhase(cyclePhase);
    const initialRightIndex = positiveModulo(-cycleIndex, toothCount);
    const leftIndex = positiveModulo(
      initialRightIndex + (toothCount - 1) / 2,
      toothCount,
    );
    const finalRightIndex = positiveModulo(
      initialRightIndex - 1,
      toothCount,
    );
    const cycleWheelBase = cycleIndex * toothPitch;

    let activePallet = 'right';
    let activeToothIndex = initialRightIndex;
    let approachingPallet = null;
    let approachingToothIndex = null;
    let dropProgress = null;
    let escapingPallet = null;
    let escapingToothIndex = null;
    let freeDrop = false;
    let stage = foliotState.speed < 0
      ? 'right-pallet-recoil-before-left-foliot-extreme'
      : 'right-pallet-impulse-after-left-foliot-extreme';
    let wheel = contactWheelState(
      'right',
      foliotState,
      cycleWheelBase,
    );

    if (
      cyclePhase >= firstReleasePhase
      && cyclePhase < firstCatchPhase
    ) {
      activePallet = null;
      activeToothIndex = null;
      approachingPallet = 'left';
      approachingToothIndex = leftIndex;
      escapingPallet = 'right';
      escapingToothIndex = initialRightIndex;
      freeDrop = true;
      const releaseFoliot = foliotAtPhase(firstReleasePhase);
      const startState = contactWheelState(
        'right',
        releaseFoliot,
        cycleWheelBase,
      );
      const catchFoliot = foliotAtPhase(firstCatchPhase);
      const endState = contactWheelState(
        'left',
        catchFoliot,
        cycleWheelBase + halfToothPitch,
      );
      wheel = quinticDrop({
        cyclePhase,
        endAngle: endState.angle,
        endPhase: firstCatchPhase,
        startPhase: firstReleasePhase,
        startState,
      });
      dropProgress = wheel.progress;
      stage = 'right-pallet-releases-free-drop-to-left-pallet';
    } else if (
      cyclePhase >= firstCatchPhase
      && cyclePhase < secondReleasePhase
    ) {
      activePallet = 'left';
      activeToothIndex = leftIndex;
      wheel = contactWheelState(
        'left',
        foliotState,
        cycleWheelBase + halfToothPitch,
      );
      stage = foliotState.speed > 0
        ? 'left-pallet-recoil-before-right-foliot-extreme'
        : 'left-pallet-impulse-after-right-foliot-extreme';
    } else if (
      cyclePhase >= secondReleasePhase
      && cyclePhase < secondCatchPhase
    ) {
      activePallet = null;
      activeToothIndex = null;
      approachingPallet = 'right';
      approachingToothIndex = finalRightIndex;
      escapingPallet = 'left';
      escapingToothIndex = leftIndex;
      freeDrop = true;
      const releaseFoliot = foliotAtPhase(secondReleasePhase);
      const startState = contactWheelState(
        'left',
        releaseFoliot,
        cycleWheelBase + halfToothPitch,
      );
      const catchFoliot = foliotAtPhase(secondCatchPhase);
      const endState = contactWheelState(
        'right',
        catchFoliot,
        cycleWheelBase + toothPitch,
      );
      wheel = quinticDrop({
        cyclePhase,
        endAngle: endState.angle,
        endPhase: secondCatchPhase,
        startPhase: secondReleasePhase,
        startState,
      });
      dropProgress = wheel.progress;
      stage = 'left-pallet-releases-free-drop-to-right-pallet';
    } else if (cyclePhase >= secondCatchPhase) {
      activePallet = 'right';
      activeToothIndex = finalRightIndex;
      wheel = contactWheelState(
        'right',
        foliotState,
        cycleWheelBase + toothPitch,
      );
      stage = 'right-pallet-recoil-before-left-foliot-extreme';
    }

    const foliotAngularSpeed = foliotState.speed * cyclesPerSecond;
    const foliotAngularAcceleration = foliotState.acceleration
      * cyclesPerSecond ** 2;
    const crownWheelAngularSpeed = wheel.speed * cyclesPerSecond;
    const crownWheelAngularAcceleration = wheel.acceleration
      * cyclesPerSecond ** 2;
    const contact = activePallet === null ? null : contactAt({
      foliotAngle: foliotState.angle,
      foliotAngularSpeed,
      side: activePallet,
      toothIndex: activeToothIndex,
      wheelAngle: wheel.angle,
      wheelAngularSpeed: crownWheelAngularSpeed,
    });

    let freeDropState = null;
    if (freeDrop) {
      freeDropState = {
        approaching: palletMetrics(
          approachingPallet,
          approachingToothIndex,
          foliotState.angle,
          wheel.angle,
        ),
        escaping: palletMetrics(
          escapingPallet,
          escapingToothIndex,
          foliotState.angle,
          wheel.angle,
        ),
        progress: dropProgress,
      };
    }

    return {
      activePallet,
      activeToothIndex,
      approachingPallet,
      approachingToothIndex,
      contact,
      crownWheelAngle: wheel.angle,
      crownWheelAngularAcceleration,
      crownWheelAngularSpeed,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      directImpulse: activePallet !== null
        && crownWheelAngularSpeed > 1e-12,
      dropProgress,
      escapingPallet,
      escapingToothIndex,
      foliotAngle: foliotState.angle,
      foliotAngularAcceleration,
      foliotAngularSpeed,
      freeDrop,
      freeDropState,
      recoil: activePallet !== null
        && crownWheelAngularSpeed < -1e-12,
      sourcePose: Math.abs(cyclePhase - displayCycleOffset) < 1e-12,
      stage,
      teethAdvanced: (wheel.angle - sourceWheelAngle) / toothPitch,
      vergeAngle: foliotState.angle,
      vergeAngularAcceleration: foliotAngularAcceleration,
      vergeAngularSpeed: foliotAngularSpeed,
      wheelAngle: wheel.angle,
      wheelAngularAcceleration: crownWheelAngularAcceleration,
      wheelAngularSpeed: crownWheelAngularSpeed,
    };
  };
  // Brown's 299 pose has one pallet lying out to the right (about 15 degrees
  // below horizontal) with a tooth tip at its very end, and the other
  // hanging steeply down-left (about 59 degrees): the instant a tooth is
  // released from a pallet tip. The display clock starts just before the
  // second release (cycle 207/256, a dyadic value so cycle closure stays exact;
  // strips about 24 and 56 degrees below horizontal); the mechanism state per
  // cycle coordinate is unchanged.
  const displayCycleOffset = 207 / 256;
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond + displayCycleOffset,
  );

  // Local crown Z becomes the horizontal world X arbor; local verge X
  // becomes the vertical world Y staff.
  root.quaternion.setFromAxisAngle(
    new THREE.Vector3(1, 1, 1).normalize(),
    FULL_TURN / 3,
  );
  const displayScale = 0.61;
  root.scale.setScalar(displayScale);
  const localAxisToWorld = (axis) => axis.clone().applyQuaternion(
    root.quaternion,
  );
  blocks.crownWheel.userData.worldAxis = localAxisToWorld(Z_AXIS);
  blocks.crownShaft.userData.worldAxis = localAxisToWorld(Z_AXIS);
  blocks.verge.userData.worldAxis = localAxisToWorld(X_AXIS);
  vergeStaff.userData.worldAxis = localAxisToWorld(X_AXIS);
  foliot.userData.worldAxis = localAxisToWorld(X_AXIS);

  root.userData.archetype =
    'recoiling-verge-and-weighted-foliot-clock-escapement';
  root.userData.blocks = {
    crownRim,
    crownShaft: blocks.crownShaft,
    crownSpokes,
    crownWheel: blocks.crownWheel,
    foliot,
    foliotBar,
    foliotHub,
    foliotIndex,
    foliotWeights,
    leftContactMarker: blocks.leftContactMarker,
    leftPallet: blocks.leftPallet,
    rightContactMarker: blocks.rightContactMarker,
    rightPallet: blocks.rightPallet,
    verge: blocks.verge,
    vergeStaff,
  };
  // Brown's 299 is a nearly orthographic detail: the verge journal end-on
  // over the crown band and its teeth, cropped to the few teeth either side
  // of the verge. Fit only that central stretch of the band (local crown
  // height -0.4..1.3, about 1.5 either side of the verge) in this
  // unpresented world frame, with a narrow field, so the outer teeth run off
  // the frame as Brown's band does.
  root.userData.hideGround = true;
  // Along the crown edge (local z, which the source presentation turns
  // horizontal) the fit spans about two and a quarter pitches, as Brown's
  // strip spans two: the wheel ends run out of view, and only the far teeth
  // nearest the verge show through the gaps (Brown's X at the left).
  // p106: the fitted box is enlarged 1/0.5 about its centre so the default
  // view shows the whole drawn band (about 0.55 of the old zoom).
  const fitCentre = new THREE.Vector3(0.45, 0, 0).multiplyScalar(displayScale);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-0.6 * displayScale, -1.5 * displayScale, -1.0 * displayScale),
    new THREE.Vector3(1.5 * displayScale, 1.5 * displayScale, 1.0 * displayScale),
  ).translate(fitCentre.clone().negate()).applyMatrix4(
    new THREE.Matrix4().makeScale(1 / 0.5, 1 / 0.5, 1 / 0.5),
  ).translate(fitCentre);
  root.userData.cameraFov = 12;
  // The raked tooth faces lie nearly edge-on to the key light; a tight shadow
  // map with normal-offset bias removes the fine acne striping on them.
  root.userData.shadowCameraHalfExtent = 4;
  root.userData.shadowBias = -0.0006;
  root.userData.shadowNormalBias = 0.025;
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    firstFreeDropMidpoint: cyclePeriod * (
      firstReleasePhase + firstCatchPhase
    ) / 2,
    leftImpulseMidpoint: cyclePeriod * 0.68,
    leftRecoilMidpoint: cyclePeriod * (
      firstCatchPhase + 0.5
    ) / 2,
    rightImpulseMidpoint: cyclePeriod * 0.18,
    rightRecoilMidpoint: cyclePeriod * (
      secondCatchPhase + 1
    ) / 2,
    secondFreeDropMidpoint: cyclePeriod * (
      secondReleasePhase + secondCatchPhase
    ) / 2,
    sourcePose: 0,
  };
  for (const [key, time] of Object.entries(root.userData.canonicalTimes)) {
    if (key === 'sourcePose' || key === 'cycleClosure') continue;
    root.userData.canonicalTimes[key] = positiveModulo(
      time / cyclePeriod - displayCycleOffset,
      1,
    ) * cyclePeriod;
  }
  root.userData.contactAt = contactAt;
  root.userData.geometry = {
    ...baseGeometry,
    catchAngle,
    contactAdvance,
    cyclePeriod,
    cyclesPerSecond,
    displayCycleOffset,
    displayScale,
    dropAngle,
    firstCatchPhase,
    firstReleasePhase,
    foliotAmplitude,
    foliotBarLength,
    foliotPositionOnStaff,
    foliotWeightOffset,
    palletFaceSpan,
    palletReleaseDistance,
    palletRootDistance,
    recoilAngle,
    releaseAngle,
    secondCatchPhase,
    secondReleasePhase,
    sourcePalletIncludedAngle,
    sourceScale,
    sourceWheelAngle,
    vergeAmplitude: foliotAmplitude,
    vergeStaffCenter,
    vergeStaffLength,
  };
  root.userData.mechanism =
    'one weighted horizontal foliot oscillates a vertical two-pallet verge; the roughly one-hundred-degree pallets alternately recoil, impulse, and release one odd thirteen-tooth crown wheel on a perpendicular horizontal arbor';
  root.userData.palletMetrics = palletMetrics;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 299 page marks Animated unavailable and serves only Brown’s original engraving.',
    referenceScope: 'Brown’s edge-on crown wheel, central verge journal, and two angular pallet blades; the weighted foliot and continuous recoil law complete the historically documented clock mechanism in 3D.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToPresentation = sourcePointToPresentation;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    periodReference: {
      description: 'The early clock verge-and-foliot has a saw-tooth crown wheel, two pallets about one hundred degrees apart, adjustable foliot weights, recoil before reversal, and a short free drop between alternating contacts.',
      publicationYear: 2020,
      title: 'Friction and Dynamics of Verge and Foliot: How the Invention of the Pendulum Made Clocks Much More Accurate',
      url: 'https://www.mdpi.com/2673-3161/1/2/8',
    },
    plate299: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one crown wheel shown nearly edge-on beneath one end-view verge journal and two angular pallet blades; a weighted foliot is historically implied but outside Brown’s cropped detail',
      measurementUncertaintyPixels: 8,
      modeledCrownToothCount: toothCount,
      officialAnimationAvailable: false,
      rasterCrownBounds: sourceRasterCrownBounds,
      rasterLeftCrownContact: sourceRasterLeftCrownContact,
      rasterLeftPalletTip: sourceRasterLeftPalletTip,
      rasterLeftToothApex: sourceRasterLeftToothApex,
      rasterRightCrownContact: sourceRasterRightCrownContact,
      rasterRightPalletTip: sourceRasterRightPalletTip,
      rasterRightToothApex: sourceRasterRightToothApex,
      rasterVergeJournal: sourceRasterVergeJournal,
      sourcePalletIncludedAngleDegrees: THREE.MathUtils.radToDeg(
        sourcePalletIncludedAngle,
      ),
      toothCountBasis: 'Brown crops the crown to a few teeth; thirteen preserves the historically mandatory odd count while keeping both pallet actions legible.',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    activePalletContactsAtOnce: 1,
    beatsPerFoliotOscillation: 2,
    contactAdvancePerBeatInToothPitches: contactAdvance / toothPitch,
    crownWheelDirection:
      'counterclockwise on average with recoil before each foliot reversal',
    crownWheelTeeth: toothCount,
    dropPerBeatInDegrees: THREE.MathUtils.radToDeg(dropAngle),
    dropPerBeatInToothPitches: dropAngle / toothPitch,
    foliotDirection: 'alternating about the vertical verge staff',
    foliotWeightsAdjustRate: true,
    oddCrownToothCountRequired: true,
    outputAdvancePerBeatInToothPitches: 0.5,
    outputAdvancePerOscillationInToothPitches: 1,
    palletIncludedAngleDegrees: THREE.MathUtils.radToDeg(
      baseGeometry.palletIncludedAngle,
    ),
    topology:
      'weighted-foliot-on-vertical-verge-perpendicular-to-horizontal-crown-wheel',
  };
  root.userData.cameraDistanceScale = 0.96;

  const update = (time) => {
    const state = stateAtTime(time);
    blocks.verge.rotation.x = state.foliotAngle;
    setSpin(blocks.crownWheel, state.crownWheelAngle);
    setSpin(blocks.crownShaft, state.crownWheelAngle);
    blocks.rightContactMarker.userData.active = state.activePallet === 'right';
    blocks.leftContactMarker.userData.active = state.activePallet === 'left';
    if (state.contact) {
      const marker = state.activePallet === 'right'
        ? blocks.rightContactMarker
        : blocks.leftContactMarker;
      marker.position.copy(state.contact.point);
    }
    blocks.verge.userData.angularSpeed = state.foliotAngularSpeed;
    vergeStaff.userData.angularSpeed = state.foliotAngularSpeed;
    foliot.userData.angularSpeed = state.foliotAngularSpeed;
    blocks.crownWheel.userData.angularSpeed = state.crownWheelAngularSpeed;
    blocks.crownShaft.userData.angularSpeed = state.crownWheelAngularSpeed;
    root.userData.contacts = {
      freeDrop: state.freeDropState,
      leftPalletToCrownTooth: state.activePallet === 'left'
        ? state.contact : null,
      rightPalletToCrownTooth: state.activePallet === 'right'
        ? state.contact : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return finish(root, update, new THREE.Vector3(9.8, 7.6, 12.2));
}

// Brown draws each tooth as a narrow radial stem ending in a barb hooked
// forward (counterclockwise, the running direction).  Lags are fractions of
// the tooth pitch behind the tip.  The barb point is both the outermost and
// the leading point of the tooth, and the underside of the barb is cut back
// steeply, so near the pallet only the point can reach the rest face.
const DEBAUFRE_TOOTH_PROFILE = Object.freeze({
  barbUndersideDepth: 0.3,
  barbUndersideLag: 0.26,
  kneeDepth: 0.08,
  kneeLag: 0.37,
  outerMidDepth: 0.025,
  outerMidLag: 0.18,
  stemLeadingRootLag: 0.25,
  stemTrailingRootLag: 0.4,
});

function debaufreToothOutline({
  outerRadius,
  rootRadius,
  tipAngle = 0,
  toothPitch,
}) {
  const p = DEBAUFRE_TOOTH_PROFILE;
  const polar = (radius, lag) => new THREE.Vector2(
    Math.cos(tipAngle - lag * toothPitch) * radius,
    Math.sin(tipAngle - lag * toothPitch) * radius,
  );
  return [
    polar(outerRadius, 0),
    polar(outerRadius - p.outerMidDepth, p.outerMidLag),
    polar(outerRadius - p.kneeDepth, p.kneeLag),
    polar(rootRadius, p.stemTrailingRootLag),
    polar(rootRadius, p.stemLeadingRootLag),
    polar(outerRadius - p.barbUndersideDepth, p.barbUndersideLag),
  ];
}

// Unbevelled prism: a bevel would grow the sharp working tip past the
// contact radius that the motion law is written for.
function debaufrePrism(shape, depth, curveSegments = 12) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

// Closed solid between a flat floor and a height field sampled on an x-z
// grid (pallet-local coordinates, y up).
function debaufreHeightfieldSolid(xs, zs, topAt, bottom) {
  const nx = xs.length;
  const nz = zs.length;
  const positions = [];
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < nz; j += 1) positions.push(xs[i], topAt(i, j), zs[j]);
  }
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < nz; j += 1) positions.push(xs[i], bottom, zs[j]);
  }
  const T = (i, j) => i * nz + j;
  const B = (i, j) => nx * nz + i * nz + j;
  const index = [];
  for (let i = 0; i + 1 < nx; i += 1) {
    for (let j = 0; j + 1 < nz; j += 1) {
      index.push(T(i, j), T(i, j + 1), T(i + 1, j));
      index.push(T(i + 1, j), T(i, j + 1), T(i + 1, j + 1));
    }
  }
  const last = nx - 1;
  const end = nz - 1;
  // The flat floor only needs its boundary ring: fans close the two end
  // strips over the x-wall vertices and plain quads fill the rest.
  for (let j = 0; j < end; j += 1) {
    index.push(B(1, 0), B(0, j + 1), B(0, j));
    index.push(B(last - 1, end), B(last, j), B(last, j + 1));
  }
  index.push(B(1, 0), B(1, end), B(0, end));
  index.push(B(last - 1, end), B(last - 1, 0), B(last, 0));
  for (let i = 1; i + 2 < nx; i += 1) {
    index.push(B(i, 0), B(i + 1, 0), B(i, end));
    index.push(B(i + 1, 0), B(i + 1, end), B(i, end));
  }
  for (let j = 0; j + 1 < nz; j += 1) {
    index.push(B(0, j), B(0, j + 1), T(0, j));
    index.push(B(0, j + 1), T(0, j + 1), T(0, j));
    index.push(B(last, j), T(last, j), B(last, j + 1));
    index.push(B(last, j + 1), T(last, j), T(last, j + 1));
  }
  for (let i = 0; i + 1 < nx; i += 1) {
    index.push(B(i, 0), T(i, 0), B(i + 1, 0));
    index.push(B(i + 1, 0), T(i, 0), T(i + 1, 0));
    index.push(B(i, end), B(i + 1, end), T(i, end));
    index.push(B(i + 1, end), T(i + 1, end), T(i, end));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(index);
  creaseIndexedNormals(geometry);
  return geometry;
}

function makeDebaufreRatchetWheel({
  color,
  arborRadius,
  depth,
  mountPhase,
  outerRadius,
  rimRadius,
  toothCount,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  const toothPitch = FULL_TURN / toothCount;
  const rimWidth = 0.17;
  const hubRadius = 0.3;
  const wheelMaterial = matte(color, {
    metalness: 0.18,
    roughness: 0.57,
  });
  // Edge-on (301) every tooth shows a differently inclined side wall; a
  // moderate self-glow keeps those walls from reading as a patchwork of dark
  // blocks. The same material serves both views of the one model.
  wheelMaterial.emissive.copy(wheelMaterial.color).multiplyScalar(0.45);
  wheelMaterial.color.multiplyScalar(0.65);
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.rotor = rotor;

  // Brown draws the wheel's web with plain spokes meeting boss and rim in
  // sharp corners (no fillets): the rim, four spokes, the round boss and
  // the twelve barbed teeth are one flat plate from the shared builder,
  // each window two straight spoke edges between an arc concentric with
  // the boss and the rim's inside. His 300 shows the lower pair only (the
  // upper pair is cut off by the break across the boss); they are 90
  // degrees apart, the down-left spoke about 37 degrees off the vertical.
  const toothOutlines = [];
  for (let index = 0; index < toothCount; index += 1) {
    toothOutlines.push(debaufreToothOutline({
      outerRadius,
      rootRadius: rimRadius - 0.04,
      tipAngle: mountPhase + index * toothPitch,
      toothPitch,
    }));
  }
  const ringOf = (points) => {
    const closed = points.map((point) => [point.x ?? point[0], point.y ?? point[1]]);
    closed.push(closed[0]);
    return [closed];
  };
  const rimCircle = Array.from({ length: 192 }, (_, index) => {
    const angle = index / 192 * FULL_TURN;
    return [Math.cos(angle) * rimRadius, Math.sin(angle) * rimRadius];
  });
  const union = polygonClipping.union(
    ringOf(rimCircle),
    ...toothOutlines.map(ringOf),
  );
  const outline = union[0][0].slice(0, -1);
  const spokePhase = THREE.MathUtils.degToRad(53);
  const plate = makeSpokedWheel({
    boreRadius: hubRadius - 0.01,
    hubArcRadius: 0.6,
    hubFillet: 0,
    outline,
    phase: spokePhase,
    rimFillet: 0,
    rimInnerRadius: rimRadius - rimWidth,
    spokeWidth: 0.28,
    spokes: 4,
    thickness: depth,
  }, wheelMaterial);
  plate.userData.role = 'debaufre-ratchet-wheel-one-piece-spoked-plate';
  rotor.add(plate);
  const spokeAngles = [0, 1, 2, 3].map((index) => spokePhase + index * Math.PI / 2);

  // The hub is bored for the common arbor, which turns with it.
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, hubRadius, 0, FULL_TURN, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, arborRadius, 0, FULL_TURN, true);
  hubShape.holes.push(bore);
  // Brown draws the collet as a light ring round the arbor end, not a dark
  // disk, so the hub is brass.
  const hub = new THREE.Mesh(
    debaufrePrism(hubShape, depth * 1.45, 36),
    matte(PALETTE.brass, { metalness: 0.2, roughness: 0.5 }),
  );
  hub.userData.role = 'debaufre-ratchet-wheel-hub';
  rotor.add(hub);

  // Exact tooth prisms stay as hidden analytic references for the contact
  // law and its tests; the visible teeth are part of the plate.
  const toothMeshes = [];
  const toothTips = [];
  for (let index = 0; index < toothCount; index += 1) {
    const tipAngle = mountPhase + index * toothPitch;
    const outline = toothOutlines[index];
    const tooth = new THREE.Mesh(
      debaufrePrism(new THREE.Shape(outline), depth),
      wheelMaterial,
    );
    tooth.visible = false;
    tooth.userData.index = index;
    tooth.userData.mountAngle = tipAngle;
    tooth.userData.role = 'debaufre-undercut-ratchet-tooth';
    toothMeshes.push(tooth);
    toothTips.push(new THREE.Vector3(outline[0].x, outline[0].y, 0));
    rotor.add(tooth);
  }

  root.userData.depth = depth;
  root.userData.hub = hub;
  root.userData.mountPhase = mountPhase;
  root.userData.outerRadius = outerRadius;
  root.userData.plate = plate;
  root.userData.rim = plate;
  root.userData.rimInnerRadius = rimRadius - rimWidth;
  root.userData.spokeAngles = spokeAngles;
  root.userData.teeth = toothCount;
  root.userData.toothMeshes = toothMeshes;
  root.userData.toothPitch = toothPitch;
  root.userData.toothTips = toothTips;
  return root;
}

function debaufreFrictionalRestEscapement(
  movement,
  { presentation = 'front' } = {},
) {
  // Brown's paired figures are a rotated and simplified rendering of Thomas
  // Reid's Plate VIII, fig. 45 reconstruction of Debaufre's escapement.  The
  // two thin ratchet wheels are rigid on one arbor.  Their tooth sets differ
  // by half a pitch, and the short D-section pallet on the perpendicular
  // balance staff receives one wheel and then the other.  A tooth rests on
  // the cut end of the pallet, crosses its rounded 45-degree flange to give
  // impulse, escapes, and lets the opposite wheel's tooth drop onto the same
  // rest.  There is one pallet and never more than one tooth contact.
  const root = new THREE.Group();
  const toothCount = 12;
  const toothPitch = FULL_TURN / toothCount;
  const halfToothPitch = toothPitch / 2;
  // The pallet is as thick as the impulse chord. Brown's 300 pallet is about
  // 0.28 thick; a drop of 0.45 of the half pitch (it was 0.22) thins it from
  // 0.67 to 0.475. Larger drops let the rotating D's flat corners reach the
  // passing teeth outside the carved bands.
  const dropAngle = halfToothPitch * 0.45;
  const impulseAdvance = halfToothPitch - dropAngle;
  const wheelContactRadius = 3.3;
  // Brown's 300 rim circle is about 1.78 inside, so the barbed stems run
  // from about 1.9 out to the 3.3 contact radius.
  const wheelRimRadius = 1.95;
  // Brown's side elevation (301) sets the plane spacing, D radius, arbor and
  // collet sizes: 344 px there spans the escape arbor to the pallet journal.
  const wheelPlaneOffset = 0.62;
  const wheelDepth = 0.15;
  const palletRadius = 0.8;
  const escapeArborRadius = 0.15;
  // 301's side elevation draws the spacer drum's edge; 300 and 301 share
  // one model, so the drum is the same in both views.
  const spacerDrumRadius = 0.72;
  const balanceStaffRadius = 0.12;
  const balanceStaffLength = 5.9;
  const palletColletRadius = 0.3;
  // The rest face is set back by a film so the resting tip is tangent to,
  // not coincident with, the rendered face.
  const restFaceFilm = 5e-4;
  const palletThickness = 2 * wheelContactRadius
    * Math.sin(impulseAdvance / 2);
  const palletAmplitude = THREE.MathUtils.degToRad(42);
  const impulseLimitAngle = THREE.MathUtils.degToRad(9);
  const cyclePeriod = 4;
  const cyclesPerSecond = 1 / cyclePeriod;
  const firstImpulseStartPhase = Math.acos(
    impulseLimitAngle / palletAmplitude,
  ) / FULL_TURN;
  const firstReleasePhase = Math.acos(
    -impulseLimitAngle / palletAmplitude,
  ) / FULL_TURN;
  const dropDurationInCycles = 0.035;
  const firstCatchPhase = firstReleasePhase + dropDurationInCycles;
  const secondImpulseStartPhase = 0.5 + firstImpulseStartPhase;
  const secondReleasePhase = 0.5 + firstReleasePhase;
  const secondCatchPhase = secondReleasePhase + dropDurationInCycles;
  const frontMountPhase = -Math.PI / 2 - impulseAdvance / 2;
  const rearMountPhase = frontMountPhase + halfToothPitch;
  const wheelCenterY = 1.44;
  const palletCenterY = wheelCenterY
    - wheelContactRadius * Math.cos(impulseAdvance / 2);
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(267, 166);
  const sourceRasterWheelBounds = Object.freeze({
    bottom: 395,
    left: 31,
    right: 492,
    top: 22,
  });
  const sourceRasterPalletCenter = new THREE.Vector2(244, 401);
  const sourceRasterBalanceStaffEndpoints = Object.freeze({
    left: new THREE.Vector2(57, 398),
    right: new THREE.Vector2(472, 407),
  });
  const sourceRasterProjectedToothStations = Object.freeze([
    new THREE.Vector2(469, 67),
    new THREE.Vector2(477, 173),
    new THREE.Vector2(425, 348),
    new THREE.Vector2(345, 394),
    new THREE.Vector2(153, 381),
    new THREE.Vector2(34, 224),
  ]);
  const sideRasterEscapeArborCenter = new THREE.Vector2(263, 93);
  const sideRasterWheelPlanes = Object.freeze({
    front: 330,
    rear: 201,
  });
  const sideRasterPalletJournal = new THREE.Vector2(263, 437);
  const sideRasterPalletBounds = Object.freeze({
    bottom: 521,
    left: 181,
    right: 345,
    top: 417,
  });
  const sourceScale = wheelContactRadius / (
    sourceRasterPalletCenter.y - sourceRasterWheelCenter.y
  );
  const sourcePointToPresentation = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    wheelCenterY - (y - sourceRasterWheelCenter.y) * sourceScale,
  );

  const frontWheel = makeDebaufreRatchetWheel({
    arborRadius: escapeArborRadius,
    color: PALETTE.driven,
    depth: wheelDepth,
    mountPhase: frontMountPhase,
    outerRadius: wheelContactRadius,
    rimRadius: wheelRimRadius,
    toothCount,
  });
  frontWheel.position.set(0, wheelCenterY, wheelPlaneOffset);
  frontWheel.userData.pairMember = 'front';
  frontWheel.userData.role = 'front-debaufre-escape-wheel';
  frontWheel.userData.worldAxis = Z_AXIS.clone();

  const rearWheel = makeDebaufreRatchetWheel({
    arborRadius: escapeArborRadius,
    color: PALETTE.fluid,
    depth: wheelDepth,
    mountPhase: rearMountPhase,
    outerRadius: wheelContactRadius,
    rimRadius: wheelRimRadius,
    toothCount,
  });
  rearWheel.position.set(0, wheelCenterY, -wheelPlaneOffset);
  rearWheel.userData.pairMember = 'rear';
  rearWheel.userData.role = 'rear-debaufre-escape-wheel';
  rearWheel.userData.worldAxis = Z_AXIS.clone();

  const commonEscapeArbor = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: wheelPlaneOffset * 2 + 1.45,
    radius: escapeArborRadius,
  });
  commonEscapeArbor.position.y = wheelCenterY;
  commonEscapeArbor.userData.role = 'common-two-wheel-escape-arbor';
  commonEscapeArbor.userData.worldAxis = Z_AXIS.clone();
  // Brown's side elevation closes the space between the wheel planes with a
  // drum edge 0.76 below the arbor and hides the arbor there. He leaves the
  // drum white between the wheel strips; it is a turned brass drum here,
  // since a white one reads as a gap on the cream page.
  const spacerDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(
      spacerDrumRadius,
      spacerDrumRadius,
      2 * wheelPlaneOffset - wheelDepth + 0.02,
      48,
    ),
    matte(PALETTE.brass, { metalness: 0.16, roughness: 0.55 }),
  );
  spacerDrum.rotation.x = Math.PI / 2;
  spacerDrum.userData.role = 'common-arbor-wheel-spacer-drum';
  commonEscapeArbor.userData.rotor.add(spacerDrum);
  root.add(rearWheel, frontWheel, commonEscapeArbor);

  const palletAssembly = new THREE.Group();
  palletAssembly.position.y = palletCenterY;
  palletAssembly.userData.axis = X_AXIS.clone();
  palletAssembly.userData.role = 'single-debaufre-pallet-and-balance-staff';
  palletAssembly.userData.worldAxis = X_AXIS.clone();
  root.add(palletAssembly);

  const balanceStaff = new THREE.Mesh(
    new THREE.CylinderGeometry(
      balanceStaffRadius,
      balanceStaffRadius,
      balanceStaffLength,
      30,
    ),
    matte(PALETTE.ink, { metalness: 0.3, roughness: 0.43 }),
  );
  balanceStaff.rotation.z = Math.PI / 2;
  balanceStaff.userData.role = 'perpendicular-balance-staff';
  palletAssembly.add(balanceStaff);

  // Pallet-local frame: x along the staff, y up through the cut-away flat.
  // The approaching teeth move toward +x and rest against the face at
  // x = -t/2; all pallet material lies on the +x side of that face.  The
  // bands where the two wheel planes cross the flat are height fields carved
  // offline by the swept rendered teeth over one full cycle
  // (scripts/generate-debaufre-300-301-pallet.mjs).
  const baked = DEBAUFRE_300_301_PALLET;
  const palletX0 = -palletThickness / 2 + restFaceFilm;
  const palletX1 = palletThickness / 2;
  const bandXs = Array.from({ length: baked.x.count }, (_, i) =>
    palletX0 + (palletX1 - palletX0) * i / (baked.x.count - 1));
  const bandZs = Array.from({ length: baked.z.count }, (_, j) =>
    baked.z.start + (baked.z.end - baked.z.start) * j / (baked.z.count - 1));
  const sweptHeight = (i, j) => baked.heights[i * baked.z.count + j]
    / baked.heightScale;
  const palletMaterial = matte(PALETTE.driver, {
    metalness: 0.08,
    roughness: 0.56,
  });
  const flangeMaterial = matte(PALETTE.brass, {
    metalness: 0.2,
    roughness: 0.45,
  });

  const palletShape = new THREE.Shape();
  palletShape.moveTo(-palletRadius, 0);
  for (const side of [-1, 1]) {
    const [near, far] = side < 0
      ? [-baked.z.end, -baked.z.start]
      : [baked.z.start, baked.z.end];
    palletShape.lineTo(near, 0);
    palletShape.lineTo(near, baked.bandFloor);
    palletShape.lineTo(far, baked.bandFloor);
    palletShape.lineTo(far, 0);
  }
  // Brown's 300 draws the D edge-on as a broad block round the staff over a
  // blade about half as thick below it. Only the upper part near the flat
  // meets the teeth (resting tips reach 0.415 below the flat at the swing
  // extremes), so the full thickness stops webStepY below the flat and a
  // centred web of Brown's blade thickness carries the rest of the D (301's
  // side elevation still sees the whole half-disc).
  const webStepY = -0.47;
  const webThickness = 0.22;
  const webStepAngle = Math.asin(-webStepY / palletRadius);
  palletShape.lineTo(palletRadius, 0);
  for (let index = 1; index < 64; index += 1) {
    const angle = -index * Math.PI / 64;
    if (angle > -webStepAngle) {
      palletShape.lineTo(
        Math.cos(angle) * palletRadius,
        Math.sin(angle) * palletRadius,
      );
    }
  }
  const webStepHalfWidth = Math.cos(webStepAngle) * palletRadius;
  palletShape.lineTo(webStepHalfWidth, webStepY);
  palletShape.lineTo(-webStepHalfWidth, webStepY);
  for (let index = 63; index >= 1; index -= 1) {
    const angle = -Math.PI + index * Math.PI / 64;
    if (angle < -Math.PI + webStepAngle) {
      palletShape.lineTo(
        Math.cos(angle) * palletRadius,
        Math.sin(angle) * palletRadius,
      );
    }
  }
  palletShape.closePath();
  const palletGeometry = new THREE.ExtrudeGeometry(palletShape, {
    bevelEnabled: false,
    depth: palletX1 - palletX0,
  });
  palletGeometry.rotateY(Math.PI / 2);
  palletGeometry.translate(palletX0, 0, 0);
  const palletBody = new THREE.Mesh(palletGeometry, palletMaterial);
  palletBody.userData.profile = 'short-cylinder-with-half-cut-away';
  palletBody.userData.restFaceX = palletX0;
  palletBody.userData.role = 'single-d-section-frictional-rest-pallet';
  palletAssembly.add(palletBody);
  const webShape = new THREE.Shape();
  webShape.moveTo(webStepHalfWidth, webStepY);
  for (let index = 0; index <= 48; index += 1) {
    const angle = -webStepAngle
      - (Math.PI - 2 * webStepAngle) * index / 48;
    webShape.lineTo(
      Math.cos(angle) * palletRadius,
      Math.sin(angle) * palletRadius,
    );
  }
  webShape.closePath();
  const webGeometry = new THREE.ExtrudeGeometry(webShape, {
    bevelEnabled: false,
    depth: webThickness,
  });
  webGeometry.rotateY(Math.PI / 2);
  webGeometry.translate(-webThickness / 2, 0, 0);
  const palletWeb = new THREE.Mesh(webGeometry, palletMaterial);
  palletWeb.userData.role = 'd-pallet-lower-blade-web';
  palletAssembly.add(palletWeb);

  const lipHalfWidth = baked.lipHalfWidth;
  const inLip = (z) => Math.abs(Math.abs(z) - wheelPlaneOffset)
    <= lipHalfWidth + 1e-9;
  // Under the flanges the band's carved top is sunk this far below the
  // flange's (the baked 0.002 skin left the steep carved faces of the two
  // within a z-fighting distance of each other); it lies wholly inside the
  // flange, and the flange carries the working surface there.
  const bandSkinUnderLip = Math.max(baked.flangeSkin, 0.005);
  const palletSweptBands = [-1, 1].map((side) => {
    const zs = side > 0 ? bandZs : bandZs.map((z) => -z).reverse();
    const column = (j) => (side > 0 ? j : baked.z.count - 1 - j);
    const band = new THREE.Mesh(
      debaufreHeightfieldSolid(
        bandXs,
        zs,
        (i, j) => Math.min(0, sweptHeight(i, column(j)))
          - (inLip(zs[j]) ? bandSkinUnderLip : 0),
        baked.bandFloor - 0.005,
      ),
      palletMaterial,
    );
    band.userData.pairMember = side > 0 ? 'front' : 'rear';
    band.userData.role = side > 0
      ? 'front-swept-rest-and-impulse-band'
      : 'rear-swept-rest-and-impulse-band';
    palletAssembly.add(band);
    return band;
  });

  const palletTopEdge = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.012, 2 * (baked.z.start - 0.02)),
    matte(PALETTE.ink, { metalness: 0.25, roughness: 0.46 }),
  );
  palletTopEdge.position.set(palletX0 + 0.0175 + 0.004, 0, 0);
  palletTopEdge.userData.role = 'pallet-cut-end-rest-edge';
  // Brown's line at the cut end is its drawn edge, not a separate dark strip.
  palletTopEdge.visible = false;
  palletTopEdge.userData.retiredInkOutline = true;
  palletAssembly.add(palletTopEdge);

  // Raised flanges in the wheel planes.  Their tops are the carved envelope
  // of the passing tooth points, so the working point stays on a flange
  // through the whole impulse instead of lifting off the flat halfway.
  const lipZs = bandZs.filter((z) => inLip(z));
  const lipStart = bandZs.indexOf(lipZs[0]);
  // The flange's two end walls stand lipEndInset inside the band's. They
  // were coplanar with the band's end walls, which run on through the
  // flange's width, and the two z-fought there. The band's rest face at
  // palletX0 is unchanged.
  const lipEndInset = 0.002;
  const lipXs = bandXs.map((x, i) => (i === 0 ? x + lipEndInset
    : i === bandXs.length - 1 ? x - lipEndInset : x));
  const impulseLips = [-1, 1].map((side) => {
    const zs = side > 0
      ? lipZs.map((z) => z - wheelPlaneOffset)
      : lipZs.map((z) => wheelPlaneOffset - z).reverse();
    const column = (j) => lipStart + (side > 0 ? j : lipZs.length - 1 - j);
    const lip = new THREE.Mesh(
      debaufreHeightfieldSolid(
        lipXs,
        zs,
        (i, j) => Math.min(baked.flangeCap, sweptHeight(i, column(j))),
        baked.bandFloor + 0.005,
      ),
      flangeMaterial,
    );
    lip.position.set(0, 0, side * wheelPlaneOffset);
    // Reid's nominal flange angle; the carved ramp is flatter (recorded).
    lip.userData.chamferAngle = Math.PI / 4;
    lip.userData.sweptRampAngle = baked.sweptRampAngle;
    lip.userData.pairMember = side > 0 ? 'front' : 'rear';
    lip.userData.role = side > 0
      ? 'front-rounded-forty-five-degree-impulse-flange'
      : 'rear-rounded-forty-five-degree-impulse-flange';
    palletAssembly.add(lip);
    return lip;
  });

  const palletHub = new THREE.Mesh(
    new THREE.CylinderGeometry(
      palletColletRadius,
      palletColletRadius,
      palletThickness * 1.42,
      36,
    ),
    // Brown's 301 draws the collet as a light ring round the staff end.
    matte(PALETTE.brass, { metalness: 0.2, roughness: 0.5 }),
  );
  palletHub.rotation.z = Math.PI / 2;
  palletHub.userData.role = 'debaufre-pallet-staff-collet';
  palletAssembly.add(palletHub);


  const frontContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 22, 16),
    matte(PALETTE.white, { roughness: 0.42 }),
  );
  frontContactMarker.userData.role = 'front-wheel-live-contact-witness';
  const rearContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 22, 16),
    matte(PALETTE.white, { roughness: 0.42 }),
  );
  rearContactMarker.userData.role = 'rear-wheel-live-contact-witness';
  // Diagnostic witnesses sit on the working point and would render through
  // tooth and pallet; they stay positioned but hidden, flagged by `active`.
  frontContactMarker.visible = false;
  rearContactMarker.visible = false;
  root.add(frontContactMarker, rearContactMarker);

  const wheelMotionAt = (cyclePhase) => {
    if (cyclePhase < firstImpulseStartPhase) {
      return { acceleration: 0, angle: 0, speed: 0 };
    }
    if (cyclePhase < firstReleasePhase) {
      const segment = segmentProgress(
        cyclePhase,
        firstImpulseStartPhase,
        firstReleasePhase,
      );
      return {
        acceleration: impulseAdvance * segment.acceleration,
        angle: impulseAdvance * segment.progress,
        speed: impulseAdvance * segment.speed,
      };
    }
    if (cyclePhase < firstCatchPhase) {
      const segment = segmentProgress(
        cyclePhase,
        firstReleasePhase,
        firstCatchPhase,
      );
      return {
        acceleration: dropAngle * segment.acceleration,
        angle: impulseAdvance + dropAngle * segment.progress,
        speed: dropAngle * segment.speed,
      };
    }
    if (cyclePhase < secondImpulseStartPhase) {
      return { acceleration: 0, angle: halfToothPitch, speed: 0 };
    }
    if (cyclePhase < secondReleasePhase) {
      const segment = segmentProgress(
        cyclePhase,
        secondImpulseStartPhase,
        secondReleasePhase,
      );
      return {
        acceleration: impulseAdvance * segment.acceleration,
        angle: halfToothPitch + impulseAdvance * segment.progress,
        speed: impulseAdvance * segment.speed,
      };
    }
    if (cyclePhase < secondCatchPhase) {
      const segment = segmentProgress(
        cyclePhase,
        secondReleasePhase,
        secondCatchPhase,
      );
      return {
        acceleration: dropAngle * segment.acceleration,
        angle: halfToothPitch + impulseAdvance
          + dropAngle * segment.progress,
        speed: dropAngle * segment.speed,
      };
    }
    return { acceleration: 0, angle: toothPitch, speed: 0 };
  };

  const toothIndexAt = (wheel, cycleIndex, afterSecondDrop) => {
    const advance = wheel === 'front' && !afterSecondDrop ? 0 : 1;
    return positiveModulo(-cycleIndex - advance, toothCount);
  };

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const phaseAngle = FULL_TURN * cyclePhase;
    const palletAngle = -palletAmplitude * Math.cos(phaseAngle);
    const palletCoordinateSpeed = palletAmplitude * FULL_TURN
      * Math.sin(phaseAngle);
    const palletCoordinateAcceleration = palletAmplitude * FULL_TURN ** 2
      * Math.cos(phaseAngle);
    const wheelMotion = wheelMotionAt(cyclePhase);
    const wheelAngle = cycleIndex * toothPitch + wheelMotion.angle;
    const wheelAngularSpeed = wheelMotion.speed / cyclePeriod;
    const wheelAngularAcceleration = wheelMotion.acceleration
      / cyclePeriod ** 2;
    const palletAngularSpeed = palletCoordinateSpeed / cyclePeriod;
    const palletAngularAcceleration = palletCoordinateAcceleration
      / cyclePeriod ** 2;

    let activeWheel = null;
    let approachingWheel = null;
    let departingWheel = null;
    let dropProgress = 0;
    let directImpulse = false;
    let frictionalRest = false;
    let impulseProgress = 0;
    if (cyclePhase < firstReleasePhase) {
      activeWheel = 'front';
      directImpulse = cyclePhase >= firstImpulseStartPhase;
      frictionalRest = !directImpulse;
      if (directImpulse) {
        impulseProgress = segmentProgress(
          cyclePhase,
          firstImpulseStartPhase,
          firstReleasePhase,
        ).progress;
      }
    } else if (cyclePhase < firstCatchPhase) {
      departingWheel = 'front';
      approachingWheel = 'rear';
      dropProgress = segmentProgress(
        cyclePhase,
        firstReleasePhase,
        firstCatchPhase,
      ).progress;
    } else if (cyclePhase < secondReleasePhase) {
      activeWheel = 'rear';
      directImpulse = cyclePhase >= secondImpulseStartPhase;
      frictionalRest = !directImpulse;
      if (directImpulse) {
        impulseProgress = segmentProgress(
          cyclePhase,
          secondImpulseStartPhase,
          secondReleasePhase,
        ).progress;
      }
    } else if (cyclePhase < secondCatchPhase) {
      departingWheel = 'rear';
      approachingWheel = 'front';
      dropProgress = segmentProgress(
        cyclePhase,
        secondReleasePhase,
        secondCatchPhase,
      ).progress;
    } else {
      activeWheel = 'front';
      frictionalRest = true;
    }

    let contact = null;
    let activeToothIndex = null;
    if (activeWheel) {
      const afterSecondDrop = cyclePhase >= secondCatchPhase;
      activeToothIndex = toothIndexAt(
        activeWheel,
        cycleIndex,
        afterSecondDrop,
      );
      const mountPhase = activeWheel === 'front'
        ? frontMountPhase
        : rearMountPhase;
      const activePlane = activeWheel === 'front'
        ? wheelPlaneOffset
        : -wheelPlaneOffset;
      const toothAngle = mountPhase
        + activeToothIndex * toothPitch
        + wheelAngle;
      const point = new THREE.Vector3(
        Math.cos(toothAngle) * wheelContactRadius,
        wheelCenterY + Math.sin(toothAngle) * wheelContactRadius,
        activePlane,
      );
      const expectedToothAngle = -Math.PI / 2
        - impulseAdvance / 2
        + (directImpulse ? impulseAdvance * impulseProgress : 0);
      contact = {
        activeToothIndex,
        directImpulse,
        frictionalRest,
        impulseProgress,
        normalSeparation: 0,
        normalVelocityError: 0,
        palletSurfacePoint: point.clone(),
        point,
        slidingContact: true,
        toothPhaseError: normalizeAngle(
          toothAngle - expectedToothAngle,
        ),
        toothTip: point.clone(),
        wheel: activeWheel,
        wheelPlane: activePlane,
      };
    }

    const freeDrop = activeWheel === null;
    const stage = freeDrop
      ? `${departingWheel}-to-${approachingWheel}-free-drop`
      : `${activeWheel}-${directImpulse
        ? 'direct-impulse'
        : 'frictional-rest'}`;
    const freeDropState = freeDrop ? {
      approachingToothIndex: toothIndexAt(
        approachingWheel,
        cycleIndex,
        approachingWheel === 'front',
      ),
      approachingWheel,
      departingWheel,
      dropAngle,
      progress: dropProgress,
    } : null;
    return {
      activeToothIndex,
      activeWheel,
      approachingWheel,
      contact,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      departingWheel,
      directImpulse,
      dropProgress,
      freeDrop,
      freeDropState,
      frictionalRest,
      palletAngle,
      palletAngularAcceleration,
      palletAngularSpeed,
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };

  // Brown's 301 draws the D level, flat side up, which happens mid-impulse
  // (pallet angle zero at a quarter cycle). The side elevation therefore
  // starts its clock there; the shared mechanism state per cycle coordinate
  // is unchanged, so 300 and 301 remain the same mechanism.
  const displayCycleOffset = presentation === 'side' ? 0.25 : 0;
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time / cyclePeriod + displayCycleOffset,
  );
  const blocks = {
    balanceStaff,
    commonEscapeArbor,
    frontContactMarker,
    frontWheel,
    impulseLips,
    palletAssembly,
    palletBody,
    palletWeb,
    palletHub,
    palletTopEdge,
    palletSweptBands,
    rearContactMarker,
    rearWheel,
    spacerDrum,
  };
  root.userData.archetype = movement.archetype;
  root.userData.blocks = blocks;
  const wheelTop = wheelCenterY + wheelContactRadius + 0.15;
  const palletBottom = palletCenterY - palletRadius - 0.15;
  let cameraDirection;
  if (presentation === 'side') {
    // Brown's 301 is an orthographic view along the balance staff.  A very
    // narrow field approximates it (at 8 degrees the near and far teeth
    // project at visibly different offsets, so the edge-on wheel strips read
    // lumpy), and the slight pitch puts the camera on the staff axis so the
    // staff reads end-on instead of as a receding rod.
    root.userData.cameraFov = 2.5;
    root.userData.cameraDistanceScale = 1;
    // Brown breaks both wheels off a little above the arbor (about 0.18 of
    // the arbor-to-pallet distance), so the view is cropped there.
    const cropTop = wheelCenterY + 0.18 * (wheelCenterY - palletCenterY);
    root.userData.cameraFitBounds = new THREE.Box3(
      new THREE.Vector3(-3.45, palletBottom, -1.45),
      new THREE.Vector3(3.45, cropTop, 1.45),
    );
    root.userData.cameraFitCropsSource = true;
    // Brown's side elevation has no ground line.
    root.userData.hideGround = true;
    const fitCenterY = (palletBottom + cropTop) / 2;
    const expectedDistance = EXPECTED_301_FIT_DISTANCE;
    cameraDirection = new THREE.Vector3(
      1,
      (palletCenterY - fitCenterY) / expectedDistance,
      0,
    );
  } else {
    root.userData.cameraDistanceScale = 0.93;
    root.userData.cameraFitBounds = new THREE.Box3(
      new THREE.Vector3(-3.75, palletBottom, -1.45),
      new THREE.Vector3(3.75, wheelTop, 1.45),
    );
    // Brown's 300 is a front elevation drawn without a ground line.
    root.userData.hideGround = true;
    cameraDirection = new THREE.Vector3(1.2, 0.9, 12.4);
  }
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    firstCatch: firstCatchPhase * cyclePeriod,
    firstFreeDropMidpoint: (
      firstReleasePhase + firstCatchPhase
    ) * cyclePeriod / 2,
    firstImpulseMidpoint: (
      firstImpulseStartPhase + firstReleasePhase
    ) * cyclePeriod / 2,
    frontRest: firstImpulseStartPhase * cyclePeriod / 2,
    rearRest: (
      firstCatchPhase + secondImpulseStartPhase
    ) * cyclePeriod / 2,
    secondCatch: secondCatchPhase * cyclePeriod,
    secondFreeDropMidpoint: (
      secondReleasePhase + secondCatchPhase
    ) * cyclePeriod / 2,
    secondImpulseMidpoint: (
      secondImpulseStartPhase + secondReleasePhase
    ) * cyclePeriod / 2,
    sourcePose: 0,
  };
  if (displayCycleOffset !== 0) {
    for (const [key, time] of Object.entries(root.userData.canonicalTimes)) {
      if (key === 'sourcePose' || key === 'cycleClosure') continue;
      root.userData.canonicalTimes[key] = positiveModulo(
        time / cyclePeriod - displayCycleOffset,
        1,
      ) * cyclePeriod;
    }
  }
  root.userData.geometry = {
    cyclePeriod,
    cyclesPerSecond,
    displayCycleOffset,
    dropAngle,
    dropDurationInCycles,
    firstCatchPhase,
    firstImpulseStartPhase,
    firstReleasePhase,
    frontMountPhase,
    halfToothPitch,
    impulseAdvance,
    impulseLimitAngle,
    palletAmplitude,
    palletCenterY,
    palletRadius,
    palletThickness,
    rearMountPhase,
    secondCatchPhase,
    secondImpulseStartPhase,
    secondReleasePhase,
    sourceScale,
    toothCount,
    toothPitch,
    balanceStaffLength,
    balanceStaffRadius,
    escapeArborRadius,
    palletColletRadius,
    restFaceFilm,
    restFaceX: palletX0,
    spacerDrumRadius,
    toothProfile: DEBAUFRE_TOOTH_PROFILE,
    wheelCenterY,
    wheelContactRadius,
    wheelDepth,
    wheelPlaneOffset,
    wheelRimRadius,
  };
  root.userData.mechanism =
    'two thin twelve-tooth undercut ratchet escape wheels are rigidly coaxial and half a tooth pitch apart; one short D-section pallet on the perpendicular balance staff takes their frictional rests and rounded-flange impulses alternately';
  root.userData.pairedMechanismKey =
    'brown-300-301-debaufre-double-wheel-escapement';
  root.userData.presentation = `${presentation} elevation`;
  root.userData.presentationView = presentation;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official paired Movement 300/301 pages mark Animated unavailable and serve Brown’s two original elevations only.',
    referenceScope: 'Brown’s front elevation fixes the projected interleaved ratchet teeth, common escape arbor, perpendicular balance staff, and edge-on pallet; Brown’s paired side elevation fixes the two wheel planes and single D-section pallet between them.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToPresentation = sourcePointToPresentation;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    pairedSourceUrl: presentation === 'side'
      ? 'https://507movements.com/mm_300.html'
      : 'https://507movements.com/mm_301.html',
    periodReference: {
      author: 'Thomas Reid',
      description: 'Reid’s Plate VIII figure 45 shows two flat ratchet-toothed wheels on one arbor, their teeth opposite the middle of one another’s spaces, and a short cut-away cylindrical pallet on the orthogonal balance axis. A tooth rests on the remaining base, passes over the rounded flange to impulse the balance, escapes, and a tooth of the other wheel drops onto the base.',
      figure: 'Plate VIII, figure 45',
      publicationYear: 1847,
      title: 'A Treatise on Clock and Watch Making, Theoretical and Practical, third edition',
      url: 'https://archive.org/details/treatiseonclockw00reid_0',
    },
    plate300: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'front elevation of two superposed equal ratchet wheels on one arbor, with interleaved half-pitch tooth sets acting on one edge-on pallet carried by a perpendicular horizontal balance staff',
      measurementUncertaintyPixels: 8,
      modeledProjectedToothStations: toothCount * 2,
      modeledTeethPerWheel: toothCount,
      officialAnimationAvailable: false,
      rasterBalanceStaffEndpoints: sourceRasterBalanceStaffEndpoints,
      rasterPalletCenter: sourceRasterPalletCenter,
      rasterProjectedToothStations: sourceRasterProjectedToothStations,
      rasterWheelBounds: sourceRasterWheelBounds,
      rasterWheelCenter: sourceRasterWheelCenter,
      toothCountBasis: 'Brown’s superposed front outlines resolve to approximately twenty-four alternating projected stations; twelve teeth per wheel also matches Reid’s ratchet-wheel reconstruction.',
    },
    plate301: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'paired side elevation showing two parallel wheel planes on one common arbor and a single D-section pallet centered between them on an orthogonal staff',
      measurementUncertaintyPixels: 7,
      rasterEscapeArborCenter: sideRasterEscapeArborCenter,
      rasterPalletBounds: sideRasterPalletBounds,
      rasterPalletJournal: sideRasterPalletJournal,
      rasterWheelPlanes: sideRasterWheelPlanes,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    activeContactsAtOnce: 1,
    beatsPerBalanceOscillation: 2,
    commonArbor: true,
    directImpulseAdvancePerBeatInDegrees:
      THREE.MathUtils.radToDeg(impulseAdvance),
    dropPerBeatInDegrees: THREE.MathUtils.radToDeg(dropAngle),
    frictionalRest: true,
    palletCount: 1,
    rearToFrontMountPhaseDegrees:
      THREE.MathUtils.radToDeg(halfToothPitch),
    toothSetsAlternate: true,
    topology:
      'two-rigid-coaxial-half-pitch-ratchet-wheels-to-one-perpendicular-d-section-pallet',
    wheelAdvancePerBeatInToothPitches: 0.5,
    wheelAdvancePerOscillationInToothPitches: 1,
    wheelDirection: 'counterclockwise in the front elevation with no recoil',
    wheelTeethEach: toothCount,
    wheelsRigidlyCoupled: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(frontWheel, state.wheelAngle);
    setSpin(rearWheel, state.wheelAngle);
    setSpin(commonEscapeArbor, state.wheelAngle);
    palletAssembly.rotation.x = state.palletAngle;
    frontContactMarker.userData.active = state.activeWheel === 'front';
    rearContactMarker.userData.active = state.activeWheel === 'rear';
    if (state.contact) {
      const marker = state.activeWheel === 'front'
        ? frontContactMarker
        : rearContactMarker;
      marker.position.copy(state.contact.point);
    }
    frontWheel.userData.angularSpeed = state.wheelAngularSpeed;
    rearWheel.userData.angularSpeed = state.wheelAngularSpeed;
    commonEscapeArbor.userData.angularSpeed = state.wheelAngularSpeed;
    palletAssembly.userData.angularSpeed = state.palletAngularSpeed;
    root.userData.contacts = {
      freeDrop: state.freeDropState,
      frontWheelToSinglePallet: state.activeWheel === 'front'
        ? state.contact
        : null,
      rearWheelToSinglePallet: state.activeWheel === 'rear'
        ? state.contact
        : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  const finished = finish(root, update, cameraDirection);
  // The recessed web would carry a band of the upper block's shadow across
  // the D that Brown draws plain in the side elevation.
  if (presentation === 'side') palletWeb.receiveShadow = false;
  return finished;
}

// Brown draws 234 floating on the page with no ground, so no ground shadow.
// He draws no frame either. A plain U-frame in the verge's own vertical plane
// carries S in a bored cock at each end (past the wheel, clear of the flags)
// and the crown-wheel arbor in a foot bearing on the bar joining their feet
// under the arbor end. The view is framed without it.
// p93: Brown's toothed cup is one wall with the saw cut into its top edge.
// The shared builder stood a separate arc-sampled tooth on a 64-sided band,
// so the band's flats and the teeth's true arcs stepped against each other.
// Build the band and its 13 teeth as one closed wall between true circles,
// with the same tooth law (tip angles, linear back over 0.8 of a pitch, flat
// gap at the band top), and hide the separate teeth.
function unifiedToothedCup234(g, band, teeth) {
  const p = band.geometry.attributes.position;
  let inner = Infinity, outer = 0;
  for (let i = 0; i < p.count; i += 1) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    inner = Math.min(inner, r); outer = Math.max(outer, r);
  }
  const base = g.toothBaseZ - g.bodyDepth, root = g.toothBaseZ, tip = g.toothTipZ;
  const pitch = g.toothPitch, back = pitch * 0.8, tips = teeth.map((t) => t.userData.mountAngle).sort((a, b) => a - b);
  // Samples of the top edge, one turn from the first tooth's tip.
  const samples = [];
  for (let k = 0; k < tips.length; k += 1) {
    const t0 = tips[k];
    const gapSteps = Math.max(2, Math.ceil((pitch - back) / 0.02)), backSteps = Math.max(8, Math.ceil(back / 0.02));
    for (let i = 0; i <= gapSteps; i += 1) samples.push([t0 + (pitch - back) * i / gapSteps, root, i === 0]);
    for (let i = 1; i <= backSteps; i += 1) samples.push([t0 + (pitch - back) + back * i / backSteps, root + (tip - root) * i / backSteps, false]);
  }
  samples.push([tips[0] + tips.length * pitch, root, true]);
  const positions = [], normals = [];
  const polar = (r, a, z) => new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
  const push = (points, pointNormals) => points.forEach((q, k) => { positions.push(q.x, q.y, q.z); const n = pointNormals[k]; normals.push(n.x, n.y, n.z); });
  const tri = (a, b, c, desired, n) => {
    const face = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (face.lengthSq() < 1e-14) return;
    const flip = face.dot(desired) < 0, fn = face.normalize().multiplyScalar(flip ? -1 : 1);
    const ns = n ?? [fn, fn, fn];
    if (flip) push([a, c, b], [ns[0], ns[2], ns[1]]); else push([a, b, c], ns);
  };
  const quad = (a, b, c, d, desired, n) => { tri(a, b, c, desired, n && [n[0], n[1], n[2]]); tri(a, c, d, desired, n && [n[0], n[2], n[3]]); };
  for (let i = 0; i + 1 < samples.length; i += 1) {
    const [a0, z0] = samples[i], [a1, z1, step] = samples[i + 1];
    const out0 = new THREE.Vector3(Math.cos(a0), Math.sin(a0), 0), out1 = new THREE.Vector3(Math.cos(a1), Math.sin(a1), 0);
    const mid = out0.clone().add(out1).normalize();
    // At a tooth tip the edge drops straight from the tip to the band top.
    const top1 = step ? tip : z1;
    quad(polar(outer, a0, base), polar(outer, a1, base), polar(outer, a1, top1), polar(outer, a0, z0), mid, [out0, out1, out1, out0]);
    const in0 = out0.clone().negate(), in1 = out1.clone().negate();
    quad(polar(inner, a0, base), polar(inner, a1, base), polar(inner, a1, top1), polar(inner, a0, z0), mid.clone().negate(), [in0, in1, in1, in0]);
    quad(polar(outer, a0, z0), polar(outer, a1, top1), polar(inner, a1, top1), polar(inner, a0, z0), new THREE.Vector3(0, 0, 1));
    quad(polar(outer, a0, base), polar(outer, a1, base), polar(inner, a1, base), polar(inner, a0, base), new THREE.Vector3(0, 0, -1));
    if (step) {
      const forward = new THREE.Vector3(-Math.sin(a1), Math.cos(a1), 0);
      quad(polar(inner, a1, root), polar(outer, a1, root), polar(outer, a1, tip), polar(inner, a1, tip), forward);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function hideGroundFor234(model) {
  const root = model.root, g = root.userData.geometry;
  root.userData.hideGround = true;
  {
    let band = null;
    const teeth = [];
    root.traverse((o) => {
      if (o.userData.role === 'crown-wheel-tooth-band') band = o;
      if (o.userData.role === 'axial-saw-tooth') teeth.push(o);
    });
    const geometry = unifiedToothedCup234(g, band, teeth);
    band.geometry.dispose();
    band.geometry = geometry;
    band.position.z = 0;
    band.userData.role = 'crown-wheel-toothed-cup-wall';
    band.userData.unifiedWithTeeth = true;
    for (const tooth of teeth) tooth.visible = false;
  }
  const mat = supportMaterial();
  const vergeZ = g.axialLayers.vergeAxis;
  // Brown's crown is an open cup: its floor shows only the arbor's hole, so
  // the hub and the arbor end stop inside the floor, under a dark bore.
  let floorTop = null, bore = null;
  root.traverse((o) => {
    if (o.userData.role === 'crown-wheel-floor') {
      const p = o.geometry.parameters;
      floorTop = o.position.z + p.height / 2;
      bore = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 32), matte(PALETTE.ink, { metalness: 0.25, roughness: 0.48 }));
      bore.rotation.x = Math.PI / 2;
      bore.position.z = floorTop + 0.004;
      bore.userData.role = 'crown-wheel-arbor-bore';
    }
  });
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || floorTop === null) return;
    let role = '';
    for (let a = o; a && !role; a = a.parent) role = a.userData.role ?? '';
    if (o.userData.role === 'crown-wheel-hub') {
      const low = floorTop - 0.4, high = floorTop - 0.02;
      o.geometry.dispose();
      o.geometry = new THREE.CylinderGeometry(0.28, 0.28, high - low, 32);
      o.position.z = (low + high) / 2;
      o.parent.add(bore);
    } else if (o.geometry.type === 'CylinderGeometry' && /vertical-crown-wheel-arbor/.test(role)) {
      const box = new THREE.Box3().setFromObject(o), p = o.geometry.parameters;
      const low = box.min.z, high = floorTop - 0.02;
      o.geometry.dispose();
      o.geometry = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height * (high - low) / (box.max.z - box.min.z), p.radialSegments);
      // The shaft's axis is the world z axis; recentre it on the new span.
      o.updateMatrixWorld(true);
      const shift = (low + high) / 2 - new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).z;
      o.parent.position.z += shift;
    }
  });
  let spindleHalf = 0, arborBottom = 0, arborRadius = 0;
  root.traverse((o) => {
    if (o.userData.role === 'oscillating-spindle-S') spindleHalf = o.geometry.parameters.height / 2;
    if (o.userData.role === 'vertical-crown-wheel-arbor') {
      const box = new THREE.Box3().setFromObject(o);
      arborBottom = box.min.z; arborRadius = (box.max.x - box.min.x) / 2;
    }
  });
  const cockX = spindleHalf - 0.2, baseZ = arborBottom - 0.3;
  const frame = new THREE.Group();
  frame.userData.role = 'fixed-plain-u-frame-for-verge-and-arbor';
  for (const side of [-1, 1]) {
    // Bored cock round S (axis x), on a post down to the base bar.
    const cock = new THREE.Mesh(ring(0.079, 0.16, -0.12, 0.12, 48), mat);
    cock.rotation.y = Math.PI / 2;
    cock.position.set(side * cockX, 0, vergeZ);
    cock.userData.role = 'fixed-verge-cock-bearing';
    frame.add(cock);
  }
  // Post from each cock down to the base, and the base bar under the arbor
  // (a bar in the verge's plane: local frame x, z; backBar draws in x-y, so
  // turn it into x-z).
  const plane = new THREE.Group();
  plane.rotation.x = Math.PI / 2;
  plane.add(backBar([new THREE.Vector2(-cockX, vergeZ - 0.15), new THREE.Vector2(-cockX, baseZ),
    new THREE.Vector2(cockX, baseZ), new THREE.Vector2(cockX, vergeZ - 0.15)],
    { zFront: 0.06, width: 0.13, thickness: 0.12, material: mat, role: 'fixed-verge-posts-and-base-bar' }));
  frame.add(plane);
  const foot = new THREE.Mesh(ring(arborRadius + 0.004, arborRadius + 0.14, baseZ + 0.1, arborBottom + 0.35, 64), mat);
  foot.userData.role = 'fixed-arbor-foot-bearing';
  frame.add(foot);
  frame.traverse((o) => { if (o.isMesh) { o.userData.fixed = true; o.castShadow = o.receiveShadow = true; o.material.fog = false; } });
  freezeFitBoundsWithout(root, model.update, g.cyclePeriod, []);
  root.add(frame);
  root.userData.blocks = { ...(root.userData.blocks ?? {}), vergeFrame: frame };
  return model;
}

export function createAuthoredEscapementMovement(movement) {
  switch (movement.id) {
    // Brown's plate shows no frame or bearings for this verge.
    // Brown's cup wall below the teeth is about half the tooth height.
    case 234: return hideGroundFor234(vergeAndCrownWheelEscapement(movement, {
      // Brown's 234: a flush plate on a shallow band (about 0.2 of the
      // radius), a thin rim cut into teeth about a third of the radius high,
      // plain flags A on a round spindle S longer than the wheel.
      // Brown's flags hang about 0.3 of the wheel radius below S and are
      // nearly as wide. The flag reaches exactly to its release edge, so its
      // length is set by the verge law: a 13-degree half swing (not 25)
      // raises S to 0.35 above the tips and gives flags 0.77 long.
      bodyDepth: 0.44,
      flagPallets: true,
      includeFrame: false,
      palletIncludedAngleDegrees: 70,
      palletWidth: 0.9,
      roundSpindle: true,
      spindleLength: 8.4,
      toothRadialDepth: 0.14,
      toothTipZ: 0.72,
      vergeAmplitudeDegrees: 13,
      // Brown's flags both hang in view, which in this camera happens with
      // the verge near mid-swing: the display clock starts at the middle of
      // the right flag's impulse.
      displayCycleOffset: 0.22,
    }));
    case 238: return sixPointAnchorEscapement(movement);
    case 299: return oldFashionedClockVergeEscapement(movement);
    case 300: return debaufreFrictionalRestEscapement(movement);
    case 301: return debaufreFrictionalRestEscapement(movement, {
      presentation: 'side',
    });
    case 302: return sidewaysBalanceWheelCrownEscapement(movement);
    default: return null;
  }
}
