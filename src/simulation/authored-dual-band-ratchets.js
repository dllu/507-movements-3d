import { dualBandPawlDimensions, pawl390Angle, pawl390RestingLift, install390Pawls } from './dual-band-pawl-contact.js';
import { boredAxialCylinder, correctDualBandInterfaces, finishAlternatingDrive } from './alternating-drive-finite-parts.js';
import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';
import {
  PALETTE,
  makeDynamicLink,
  makeDynamicMovingBelt,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

// A wrap on a groove whose axial position eases from z0 to z1 (zero axial
// slope at both ends), used where the crossed band shifts across its pulley so
// that its two straight spans pass each other at D in parallel planes.
class GrooveWrapCurve3 extends THREE.Curve {
  constructor(center, radius, startAngle, sweep, z0, z1 = z0) {
    super();
    this.center = center.clone();
    this.radius = radius;
    this.startAngle = startAngle;
    this.sweep = sweep;
    this.z0 = z0;
    this.z1 = z1;
    const arc = Math.abs(sweep) * radius;
    // Exact for a planar wrap; for the eased shift, a fine fixed quadrature
    // (the lower wrap never changes shape, so its length is one constant).
    if (z0 === z1) this.length = arc;
    else {
      let length = 0;
      const n = 4096;
      for (let i = 0; i < n; i += 1) {
        const t = (i + 0.5) / n;
        const dz = (z1 - z0) * 6 * t * (1 - t);
        length += Math.hypot(arc, dz) / n;
      }
      this.length = length;
    }
  }

  zAt(parameter) {
    const t = parameter;
    return this.z0 + (this.z1 - this.z0) * t * t * (3 - 2 * t);
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    return target.set(
      this.center.x + this.radius * Math.cos(angle),
      this.center.y + this.radius * Math.sin(angle),
      this.zAt(parameter),
    );
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }

  getTangent(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    const t = parameter;
    return target.set(
      -Math.sin(angle) * this.sweep * this.radius,
      Math.cos(angle) * this.sweep * this.radius,
      (this.z1 - this.z0) * 6 * t * (1 - t),
    ).normalize();
  }

  getTangentAt(parameter, target = new THREE.Vector3()) {
    return this.getTangent(parameter, target);
  }

  getLength() {
    return this.length;
  }

  getLengths(divisions = 200) {
    return Array.from(
      { length: divisions + 1 },
      (_, index) => this.length * index / divisions,
    );
  }

  getUtoTmapping(value) {
    return value;
  }
}

function tangentJoinDot(first, firstParameter, second, secondParameter) {
  return first.getTangent(firstParameter).dot(
    second.getTangent(secondParameter),
  );
}

// Tangent points of the open (external) or crossed (internal) common tangents
// between piece A's band circle and a loose pulley's band circle. "Right" is
// the span leaving A's right-hand side.
function bandTangents({ crossed, lowerCenter, lowerRadius, sectorCenter, sectorRadius }) {
  const direction = new THREE.Vector2().subVectors(lowerCenter, sectorCenter);
  const distance = direction.length();
  const along = direction.clone().divideScalar(distance);
  const across = new THREE.Vector2(-along.y, along.x);
  const projection = (crossed ? sectorRadius + lowerRadius
    : sectorRadius - lowerRadius) / distance;
  const perpendicular = Math.sqrt(1 - projection ** 2);
  const rightNormal = along.clone().multiplyScalar(projection)
    .addScaledVector(across, perpendicular);
  const leftNormal = along.clone().multiplyScalar(projection)
    .addScaledVector(across, -perpendicular);
  const sign = crossed ? -1 : 1;
  const upperAngle = (normal) => Math.atan2(normal.y, normal.x);
  const rightUpperAngle = upperAngle(rightNormal);
  let leftUpperAngle = upperAngle(leftNormal);
  if (leftUpperAngle < 0) leftUpperAngle += FULL_TURN;
  return {
    leftLower: lowerCenter.clone().addScaledVector(leftNormal, sign * lowerRadius),
    leftUpperAngle,
    rightLower: lowerCenter.clone().addScaledVector(rightNormal, sign * lowerRadius),
    rightUpperAngle,
  };
}

// One band, both ends fastened to piece A where its rim meets the lever bar
// (anchorLift below the horn), wrapped in A's groove down to the tangent
// point, a straight taut span, a wrap round the loose pulley's groove, a
// straight taut span and the wrap back up A's other side. The ends turn with
// A; the two upper wraps change by +alpha and -alpha, so the length is fixed.
function anchoredBandCurve({
  anchorLift,
  crossed,
  crossShift = 0,
  lowerCenter,
  lowerRadius,
  rockerAngle,
  sectorCenter,
  sectorRadius,
  z,
}) {
  const tangents = bandTangents({
    crossed, lowerCenter, lowerRadius, sectorCenter, sectorRadius,
  });
  // The right-hand end runs in the plane z - shift, the left-hand end in
  // z + shift; the pulley wrap eases between them.
  const rightZ = z - crossShift;
  const leftZ = z + crossShift;
  const rightAnchorAngle = -anchorLift + rockerAngle;
  const leftAnchorAngle = Math.PI + anchorLift + rockerAngle;
  const firstWrapAngle = rightAnchorAngle - tangents.rightUpperAngle;
  const secondWrapAngle = tangents.leftUpperAngle - leftAnchorAngle;
  if (firstWrapAngle <= 0 || secondWrapAngle <= 0) {
    throw new RangeError('Rocking sector exhausted an anchored band wrap.');
  }
  const firstUpperWrap = new GrooveWrapCurve3(
    sectorCenter, sectorRadius, rightAnchorAngle, -firstWrapAngle, rightZ,
  );
  const rightUpper = firstUpperWrap.getPoint(1);
  const rightLower = new THREE.Vector3(tangents.rightLower.x, tangents.rightLower.y, rightZ);
  const firstSpan = new THREE.LineCurve3(rightUpper, rightLower);
  const startAngle = Math.atan2(
    tangents.rightLower.y - lowerCenter.y,
    tangents.rightLower.x - lowerCenter.x,
  );
  const endAngle = Math.atan2(
    tangents.leftLower.y - lowerCenter.y,
    tangents.leftLower.x - lowerCenter.x,
  );
  // Continue round the pulley in the direction the span arrives.
  const arrival = new THREE.Vector2(rightLower.x - rightUpper.x, rightLower.y - rightUpper.y);
  const radial = new THREE.Vector2(
    tangents.rightLower.x - lowerCenter.x,
    tangents.rightLower.y - lowerCenter.y,
  );
  const counterClockwise = radial.x * arrival.y - radial.y * arrival.x > 0;
  let sweep = endAngle - startAngle;
  if (counterClockwise) sweep = positiveModulo(sweep, FULL_TURN);
  else sweep = -positiveModulo(-sweep, FULL_TURN);
  const lowerArc = new GrooveWrapCurve3(
    lowerCenter, lowerRadius, startAngle, sweep, rightZ, leftZ,
  );
  const leftLower = new THREE.Vector3(tangents.leftLower.x, tangents.leftLower.y, leftZ);
  const secondUpperWrap = new GrooveWrapCurve3(
    sectorCenter, sectorRadius, tangents.leftUpperAngle, -secondWrapAngle, leftZ,
  );
  const leftUpper = secondUpperWrap.getPoint(0);
  const secondSpan = new THREE.LineCurve3(leftLower, leftUpper);
  const curve = new THREE.CurvePath();
  curve.add(firstUpperWrap);
  curve.add(firstSpan);
  curve.add(lowerArc);
  curve.add(secondSpan);
  curve.add(secondUpperWrap);
  const firstAnchor = firstUpperWrap.getPoint(0);
  const secondAnchor = secondUpperWrap.getPoint(1);
  curve.userData = {
    crossed,
    crossShift,
    firstAnchor,
    firstAnchorAngle: rightAnchorAngle,
    firstDeparture: rightUpper,
    firstDepartureAngle: tangents.rightUpperAngle,
    firstWrapAngle,
    fixedLowerAndSpanLength: firstSpan.getLength()
      + lowerArc.getLength() + secondSpan.getLength(),
    joinTangentDots: [
      tangentJoinDot(firstUpperWrap, 1, firstSpan, 0),
      tangentJoinDot(firstSpan, 1, lowerArc, 0),
      tangentJoinDot(lowerArc, 1, secondSpan, 0),
      tangentJoinDot(secondSpan, 1, secondUpperWrap, 0),
    ],
    lowerWrapAngle: Math.abs(sweep),
    secondAnchor,
    secondAnchorAngle: leftAnchorAngle,
    secondDeparture: leftUpper,
    secondDepartureAngle: tangents.leftUpperAngle,
    secondWrapAngle,
    upperWrapLength: sectorRadius
      * (firstWrapAngle + secondWrapAngle),
  };
  return curve;
}

// Piece A's rim: a closed (r, z) section, with its band grooves, revolved
// through the lower half-turn and capped flat at both horns.
function grooveRimGeometry(profile, startAngle, sweep, segments = 160) {
  const positions = [];
  const normals = [];
  const push = (p, n) => { positions.push(...p); normals.push(...n); };
  const at = ([r, z], angle) => [r * Math.cos(angle), r * Math.sin(angle), z];
  const triangle = (a, b, c, normal) => {
    const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const ac = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = new THREE.Vector3(...normal);
    if (ab.cross(ac).dot(n) < 0) [b, c] = [c, b];
    push(a, normal); push(b, normal); push(c, normal);
  };
  for (let e = 0; e < profile.length; e += 1) {
    const p0 = profile[e], p1 = profile[(e + 1) % profile.length];
    const dr = p1[0] - p0[0], dz = p1[1] - p0[1], len = Math.hypot(dr, dz);
    const nr = dz / len, nz = -dr / len; // outward for a CCW (r, z) section
    for (let i = 0; i < segments; i += 1) {
      const a0 = startAngle + sweep * i / segments;
      const a1 = startAngle + sweep * (i + 1) / segments;
      const n0 = [nr * Math.cos(a0), nr * Math.sin(a0), nz];
      const n1 = [nr * Math.cos(a1), nr * Math.sin(a1), nz];
      const quad = [[at(p0, a0), n0], [at(p1, a0), n0], [at(p1, a1), n1], [at(p0, a1), n1]];
      for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
        const [a, na] = quad[i0], [b, nb] = quad[i1], [c, nc] = quad[i2];
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        const mean = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
        if (cross[0] * mean[0] + cross[1] * mean[1] + cross[2] * mean[2] < 0) {
          push(a, na); push(c, nc); push(b, nb);
        } else { push(a, na); push(b, nb); push(c, nc); }
      }
    }
  }
  const faces = THREE.ShapeUtils.triangulateShape(
    profile.map(([r, z]) => new THREE.Vector2(r, z)), [],
  );
  for (const [angle, outward] of [[startAngle, -1], [startAngle + sweep, 1]]) {
    const direction = Math.sign(sweep) * outward;
    const normal = [-Math.sin(angle) * direction, Math.cos(angle) * direction, 0];
    for (const [i, j, k] of faces) {
      triangle(at(profile[i], angle), at(profile[j], angle), at(profile[k], angle), normal);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function makeRatchetWheel({
  depth,
  material,
  outerRadius,
  rootRadius,
  toothCount,
  z,
  role,
}) {
  const shape = new THREE.Shape();
  const pitch = FULL_TURN / toothCount;
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const sample of [
      { offset: -0.50, radius: rootRadius },
      { offset: -0.38, radius: outerRadius },
      { offset: 0.34, radius: outerRadius * 0.91 },
      { offset: 0.50, radius: rootRadius },
    ]) {
      const angle = tooth * pitch + sample.offset * pitch;
      const x = sample.radius * Math.cos(angle);
      const y = sample.radius * Math.sin(angle);
      if (first) {
        shape.moveTo(x, y);
        first = false;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const wheel = new THREE.Mesh(geometry, material);
  wheel.position.z = z;
  wheel.userData.role = role;
  wheel.userData.toothCount = toothCount;
  wheel.userData.toothPitch = pitch;
  return wheel;
}

function makeLoosePulleyCarrier({
  beltMaterial,
  darkMaterial,
  pawlMaterial,
  planeZ,
  pulleyRadius,
  ratchetOuterRadius,
  role,
  whiteMaterial,
}) {
  const carrier = new THREE.Group();
  carrier.userData.role = role;

  const pulley = cylinderAlongZ(
    pulleyRadius * 0.90,
    0.22,
    beltMaterial,
    48,
  );
  pulley.position.z = planeZ;
  pulley.userData.role = `${role}-loose-band-pulley-body`;
  carrier.add(pulley);

  // The grooved rim is part of the pulley, in the pulley's own colour.
  const groove = new THREE.Mesh(
    new THREE.TorusGeometry(pulleyRadius, 0.052, 10, 56),
    beltMaterial,
  );
  groove.position.z = planeZ;
  groove.userData.role = `${role}-band-groove`;
  carrier.add(groove);

  const hub = cylinderAlongZ(0.13, 0.27, darkMaterial, 26);
  hub.position.z = planeZ;
  hub.userData.role = `${role}-loose-shaft-bushing`;
  carrier.add(hub);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(pulleyRadius * 0.62, 0.055, 0.030),
    whiteMaterial,
  );
  faceIndex.position.set(
    pulleyRadius * 0.34,
    0,
    planeZ + 0.13,
  );
  faceIndex.userData.role = 'white-loose-pulley-spin-index';
  carrier.add(faceIndex);

  const pawlPhase = 0.72;
  const pawlHingeRadius = pulleyRadius * 0.73;
  const pawlLength = pawlHingeRadius - ratchetOuterRadius * 0.91;
  const pawl = new THREE.Group();
  pawl.position.set(
    pawlHingeRadius * Math.cos(pawlPhase),
    pawlHingeRadius * Math.sin(pawlPhase),
    planeZ + 0.15,
  );
  pawl.userData.baseAngle = pawlPhase + Math.PI;
  pawl.userData.role = `${role}-ratchet-driving-pawl`;
  const pawlBody = makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.065,
    jointRadius: 0.052,
    thickness: 0.065,
  });
  pawlBody.userData.setEndpoints(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(pawlLength, 0, 0),
  );
  pawlBody.userData.role = `${role}-spring-loaded-pawl-body`;
  pawl.add(pawlBody);
  const pawlPin = cylinderAlongZ(0.060, 0.12, pawlMaterial, 20);
  pawlPin.userData.role = `${role}-pawl-hinge-pin`;
  pawl.add(pawlPin);
  const contactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 10),
    whiteMaterial,
  );
  contactIndex.position.x = pawlLength;
  contactIndex.userData.role = `${role}-white-active-pawl-contact-index`;
  pawl.add(contactIndex);
  carrier.add(pawl);

  carrier.userData.contactIndex = contactIndex;
  carrier.userData.faceIndex = faceIndex;
  carrier.userData.groove = groove;
  carrier.userData.hub = hub;
  carrier.userData.pawl = pawl;
  carrier.userData.pawlBody = pawlBody;
  carrier.userData.pawlLength = pawlLength;
  carrier.userData.pulley = pulley;
  return markShadows(carrier);
}

function dualBandOscillationRectifier(movement) {
  const root = new THREE.Group();

  const sectorCenter = new THREE.Vector2(0, 2.76);
  const lowerCenter = new THREE.Vector2(0, 0);
  const sectorRadius = 1.65;
  const loosePulleyRadius = 0.50;
  const pulleyRatio = sectorRadius / loosePulleyRadius;
  const carrierOvertravel = dualBandPawlDimensions.overtravel;
  // Each stroke advances the flywheel a quarter turn (three ratchet teeth), so
  // A swings +/-14 degrees and both band ends stay wrapped on A's rim.
  const strokeAdvance = Math.PI / 2;
  const carrierAmplitude = (strokeAdvance + carrierOvertravel) / 2;
  const rockerAmplitude = carrierAmplitude / pulleyRatio;
  // Band ends are fastened where A's rim meets the lever bar: this far below
  // the horn, the band end stands 0.007 up inside the bar's underside.
  const anchorLift = 0.044;
  // The crossed band's two spans run 0.035 either side of its mean plane, so
  // they pass each other at D with 0.02 clearance.
  const crossShift = 0.035;
  const bandWidth = 0.05;
  const bandThickness = 0.04;
  const cycleDuration = 8;
  const inputAngularFrequency = FULL_TURN / cycleDuration;
  const flywheelRadius = 1.42;
  const ratchetToothCount = 12;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  const ratchetOuterRadius = 0.34;
  const ratchetRootRadius = 0.255;
  const pawlMaximumLift = 0.29;
  const openPlaneZ = 0.29;
  const crossedPlaneZ = 0.73;
  const outputAdvancePerCycle = 2 * strokeAdvance;

  const openCurveAtAngle = (rockerAngle) => anchoredBandCurve({
    anchorLift,
    crossed: false,
    lowerCenter,
    lowerRadius: loosePulleyRadius,
    rockerAngle,
    sectorCenter,
    sectorRadius,
    z: openPlaneZ,
  });
  const crossedCurveAtAngle = (rockerAngle) => anchoredBandCurve({
    anchorLift,
    crossed: true,
    crossShift,
    lowerCenter,
    lowerRadius: loosePulleyRadius,
    rockerAngle,
    sectorCenter,
    sectorRadius,
    z: crossedPlaneZ,
  });
  const initialOpenCurve = openCurveAtAngle(0);
  const initialCrossedCurve = crossedCurveAtAngle(0);
  const openBandLength = initialOpenCurve.getLength();
  const crossedBandLength = initialCrossedCurve.getLength();
  const openUpperBaseWrap = (initialOpenCurve.userData.firstWrapAngle
    + initialOpenCurve.userData.secondWrapAngle) / 2;
  const crossedUpperBaseWrap = (initialCrossedCurve.userData.firstWrapAngle
    + initialCrossedCurve.userData.secondWrapAngle) / 2;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.11,
    roughness: 0.59,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.29,
    roughness: 0.43,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.43,
  });

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-two-shaft-rectifier-bearing-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.65, 0.22, 1.55),
    frameMaterial,
  );
  base.position.set(0, -1.61, -0.18);
  base.userData.role = 'rectifier-frame-base';
  frame.add(base);
  for (const side of [-1, 1]) {
    const post = makeDynamicLink({
      color: PALETTE.frame,
      depth: 0.20,
      jointRadius: 0.001,
      thickness: 0.18,
    });
    post.userData.setEndpoints(
      new THREE.Vector3(side * 1.48, -1.50, -0.55),
      new THREE.Vector3(side * 0.36, sectorCenter.y, -0.55),
    );
    post.userData.role = 'fixed-rocker-pivot-frame-side';
    frame.add(post);
  }
  const lowerBearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 1.53, 0.28),
    frameMaterial,
  );
  lowerBearingPost.position.set(0, -0.78, -0.68);
  lowerBearingPost.userData.role = 'fixed-flywheel-shaft-bearing-post';
  frame.add(lowerBearingPost);
  root.add(frame);

  const rockingSector = new THREE.Group();
  rockingSector.position.set(sectorCenter.x, sectorCenter.y, 0);
  rockingSector.userData.role = 'fulcrumed-semicircular-piece-A-and-lever';
  root.add(rockingSector);
  // Piece A: one flat-sided semicircular rim (Brown's ring, 0.30 wide) with
  // two band grooves turned in its edge: a narrow one for open band C and a
  // wide one in which the crossed band D's two ends lie side by side.
  const rimInner = 1.40;
  const rimOuter = sectorRadius + 0.045;
  const grooveFloor = sectorRadius - bandThickness / 2 - 0.005;
  const rimBack = 0.20;
  const rimFront = 0.85;
  const openGroove = [openPlaneZ - bandWidth / 2 - 0.01, openPlaneZ + bandWidth / 2 + 0.01];
  const crossedGroove = [
    crossedPlaneZ - crossShift - bandWidth / 2 - 0.01,
    crossedPlaneZ + crossShift + bandWidth / 2 + 0.01,
  ];
  const rimSection = [
    [rimInner, rimBack], [rimOuter, rimBack],
    [rimOuter, openGroove[0]], [grooveFloor, openGroove[0]],
    [grooveFloor, openGroove[1]], [rimOuter, openGroove[1]],
    [rimOuter, crossedGroove[0]], [grooveFloor, crossedGroove[0]],
    [grooveFloor, crossedGroove[1]], [rimOuter, crossedGroove[1]],
    [rimOuter, rimFront], [rimInner, rimFront],
  ];
  const sectorArc = new THREE.Mesh(
    grooveRimGeometry(rimSection, Math.PI, Math.PI),
    driverMaterial,
  );
  sectorArc.userData.role = 'rigid-lower-semicircular-rim-A';
  sectorArc.userData.section = rimSection;
  rockingSector.add(sectorArc);
  // Bar with Brown's round boss at fulcrum a, bored for the fixed pin.
  const topLever = new THREE.Mesh(
    plate(clip.difference(
      clip.union(
        poly([[-2.225, -0.08], [2.225, -0.08], [2.225, 0.08], [-2.225, 0.08]]),
        poly(circle([0, 0], 0.25, 96)),
      ),
      poly(circle([0, 0], 0.137, 96)),
    ), rimBack + 0.005, rimFront - 0.005),
    driverMaterial,
  );
  // The bar spans the rim's depth (0.005 inside its faces), so the rim's horns
  // and both bands' fastened ends meet its underside.
  topLever.userData.role = 'operating-lever-rigid-with-piece-A';
  rockingSector.add(topLever);
  for (const phase of [Math.PI, Math.PI * 1.5, FULL_TURN]) {
    const spoke = makeDynamicLink({
      color: PALETTE.driver,
      depth: 0.13,
      jointRadius: 0.001,
      thickness: 0.10,
    });
    spoke.userData.setEndpoints(
      new THREE.Vector3(0, 0, 0.49),
      new THREE.Vector3(
        sectorRadius * Math.cos(phase),
        sectorRadius * Math.sin(phase),
        0.49,
      ),
    );
    spoke.userData.role = 'piece-A-rigid-radial-web';
    rockingSector.add(spoke);
  }
  const rockerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.055, 0.035),
    whiteMaterial,
  );
  rockerIndex.position.set(0.37, 0, 0.70);
  rockerIndex.userData.role = 'white-rocking-piece-angle-index';
  rockingSector.add(rockerIndex);

  // Fulcrum a is a short pin through the lever boss that stands 0.05 proud
  // of each face; Brown draws no frame behind it.
  const pivotPin = cylinderAlongZ(0.13, rimFront - rimBack + 0.10, darkMaterial, 32);
  pivotPin.position.set(sectorCenter.x, sectorCenter.y, (rimFront + rimBack) / 2);
  pivotPin.userData.role = 'fixed-fulcrum-a';
  root.add(pivotPin);

  // Each band end is fastened in its groove just under the bar, turning with
  // A (local frame of piece A, rocker angle zero).
  const bandAnchorsLocal = [
    ['open-band-C', initialOpenCurve],
    ['crossed-band-D', initialCrossedCurve],
  ].flatMap(([bandName, curve]) => [
    [0, curve.userData.firstAnchor],
    [1, curve.userData.secondAnchor],
  ].map(([anchorNumber, point]) => ({
    anchorNumber,
    bandName,
    local: new THREE.Vector3(point.x - sectorCenter.x, point.y - sectorCenter.y, point.z),
  })));

  const flywheelRotor = new THREE.Group();
  flywheelRotor.position.set(lowerCenter.x, lowerCenter.y, 0);
  flywheelRotor.userData.role = 'continuous-one-direction-flywheel-B-shaft';
  root.add(flywheelRotor);
  // Brown draws flywheel B with a broad flat rim on four spokes.
  const flywheelRim = new THREE.Mesh(boredLatheGeometry([
    { axial: -0.12, radial: flywheelRadius + 0.12 },
    { axial: 0.12, radial: flywheelRadius + 0.12 },
  ], flywheelRadius - 0.30, 128), drivenMaterial);
  flywheelRim.rotation.x = Math.PI / 2;
  flywheelRim.position.z = -0.42;
  flywheelRim.userData.role = 'heavy-flywheel-B-rim-fast-on-shaft';
  flywheelRotor.add(flywheelRim);
  const flywheelSpokes = [];
  for (let index = 0; index < 4; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(flywheelRadius * 1.74, 0.12, 0.16),
      drivenMaterial,
    );
    spoke.rotation.z = index * Math.PI / 2;
    spoke.position.z = -0.42;
    spoke.userData.role = 'flywheel-B-spoke-fast-on-shaft';
    flywheelRotor.add(spoke);
    flywheelSpokes.push(spoke);
  }
  const flywheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.065, 0.035),
    whiteMaterial,
  );
  flywheelIndex.position.set(flywheelRadius - 0.40, 0, -0.31);
  flywheelIndex.userData.role = 'white-continuous-flywheel-spin-index';
  flywheelRotor.add(flywheelIndex);

  const openRatchet = makeRatchetWheel({
    depth: 0.10,
    material: brassMaterial,
    outerRadius: ratchetOuterRadius,
    role: 'open-band-ratchet-wheel-fast-on-flywheel-shaft',
    rootRadius: ratchetRootRadius,
    toothCount: ratchetToothCount,
    // Clear of the loose pulley's face (0.11) and its shortened hub.
    z: openPlaneZ + 0.165,
  });
  const crossedRatchet = makeRatchetWheel({
    depth: 0.10,
    material: brassMaterial,
    outerRadius: ratchetOuterRadius,
    role: 'crossed-band-ratchet-wheel-fast-on-flywheel-shaft',
    rootRadius: ratchetRootRadius,
    toothCount: ratchetToothCount,
    z: crossedPlaneZ + 0.165,
  });
  flywheelRotor.add(openRatchet, crossedRatchet);
  const shaft = cylinderAlongZ(0.105, 1.78, darkMaterial, 28);
  shaft.position.z = 0.02;
  shaft.userData.role = 'shaft-fast-with-both-ratchets-and-flywheel';
  flywheelRotor.add(shaft);

  const openCarrier = makeLoosePulleyCarrier({
    beltMaterial: drivenMaterial,
    darkMaterial,
    pawlMaterial: brassMaterial,
    planeZ: openPlaneZ,
    pulleyRadius: loosePulleyRadius,
    ratchetOuterRadius,
    role: 'open-band-C-loose-pulley-carrier',
    whiteMaterial,
  });
  openCarrier.position.set(lowerCenter.x, lowerCenter.y, 0);
  root.add(openCarrier);
  // Both loose pulleys are identical, in one colour, so the fast brass ratchet
  // and its dark pawls read against the front one's face.
  const crossedCarrier = makeLoosePulleyCarrier({
    beltMaterial: drivenMaterial,
    darkMaterial,
    pawlMaterial: brassMaterial,
    planeZ: crossedPlaneZ,
    pulleyRadius: loosePulleyRadius,
    ratchetOuterRadius,
    role: 'crossed-band-D-loose-pulley-carrier',
    whiteMaterial,
  });
  crossedCarrier.position.set(lowerCenter.x, lowerCenter.y, 0);
  root.add(crossedCarrier);

  const openBand = makeDynamicMovingBelt(initialOpenCurve, {
    closed: false,
    color: PALETTE.belt,
    markerColor: PALETTE.white,
    markerCount: 6,
    radius: 0.034,
    tubularSegments: 220,
    // Brown draws flat leather bands, not round cord.
    thickness: bandThickness,
    width: bandWidth,
    widthDirection: new THREE.Vector3(0, 0, 1),
  });
  openBand.userData.isBelt = true;
  openBand.userData.markers = openBand.children.slice(0, 6);
  openBand.userData.markers.forEach((marker) => {
    marker.userData.role = 'open-band-C-fixed-material-marker';
  });
  openBand.userData.role = 'one-open-uncrossed-band-C';
  root.add(openBand);
  const crossedBand = makeDynamicMovingBelt(initialCrossedCurve, {
    closed: false,
    color: PALETTE.belt,
    markerColor: PALETTE.white,
    markerCount: 6,
    radius: 0.034,
    tubularSegments: 220,
    // Brown draws flat leather bands, not round cord.
    thickness: bandThickness,
    width: bandWidth,
    widthDirection: new THREE.Vector3(0, 0, 1),
  });
  crossedBand.userData.isBelt = true;
  crossedBand.userData.markers = crossedBand.children.slice(0, 6);
  crossedBand.userData.markers.forEach((marker) => {
    marker.userData.role = 'crossed-band-D-fixed-material-marker';
  });
  crossedBand.userData.role = 'one-crossed-band-D-with-axial-crossover';
  root.add(crossedBand);

  const accumulatedRockerTravel = (phase, rockerAngle) => {
    if (phase < 0.25) return rockerAngle;
    if (phase < 0.75) return 2 * rockerAmplitude - rockerAngle;
    return 4 * rockerAmplitude + rockerAngle;
  };

  const pawlState = (flywheelAngle, carrierAngle, active, overrunning, advance) => {
    const relativeAngle = flywheelAngle - carrierAngle;
    const relativeToothPhase = positiveModulo(
      relativeAngle,
      ratchetToothPitch,
    ) / ratchetToothPitch;
    const contactError = relativeAngle
      - Math.round(relativeAngle / ratchetToothPitch)
        * ratchetToothPitch;
    return {
      active,
      contactError: active ? contactError : null,
      liftAngle: pawl390Angle(relativeAngle, { overrunning, advance })
        - dualBandPawlDimensions.seatAngle,
      overrunning,
      advance,
      takingUp: !active && !overrunning,
      relativeAngle,
      relativeToothPhase,
    };
  };

  // Relative (flywheel minus carrier) angles alone, for the pawl drop history.
  const relativeAnglesAt = (time) => {
    const phase = positiveModulo(time, cycleDuration) / cycleDuration;
    const rocker = rockerAmplitude * Math.sin(FULL_TURN * phase);
    const open = pulleyRatio * rocker, crossed = -pulleyRatio * rocker;
    const flywheel = phase < .25 ? open
      : phase < .75 ? Math.max(carrierAmplitude, crossed + strokeAdvance)
        : Math.max(carrierAmplitude + strokeAdvance, open + 2 * strokeAdvance);
    return { open: flywheel - open, crossed: flywheel - crossed };
  };
  // A pawl cannot fall into the root in zero time. Its lift over one cycle is
  // integrated once here: it never sits below the least-clearance lift, falls
  // at a finite rate (0.35 rad in 0.06 s) after a crest passes, and while the
  // receding flank still stands in front of the nose it rests on that flank.
  // The motion is periodic, so a warm-up cycle fixes the starting state.
  const pawlDropRate = 0.35 / 0.06;
  const liftSteps = 32000;
  const liftTables = {};
  for (const key of ['open', 'crossed']) {
    const dt = cycleDuration / liftSteps;
    let lift = 0;
    const table = new Float64Array(liftSteps + 1);
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i <= liftSteps; i += 1) {
        const relative = relativeAnglesAt(i * dt)[key];
        const least = pawl390Angle(relative) - dualBandPawlDimensions.seatAngle;
        lift = Math.min(least, lift + pawlDropRate * dt);
        lift = pawl390RestingLift(relative, lift);
        table[i] = lift;
      }
    }
    liftTables[key] = table;
  }
  const droppedLift = (time, key) => {
    const x = positiveModulo(time, cycleDuration) / cycleDuration * liftSteps;
    const i = Math.min(liftSteps - 1, Math.floor(x)), f = x - i, table = liftTables[key];
    return table[i] + f * (table[i + 1] - table[i]);
  };

  const stateAtTime = (time) => {
    const cycleTime = positiveModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const phaseAngle = FULL_TURN * phase;
    const rockerAngle = rockerAmplitude * Math.sin(phaseAngle);
    const rockerAngularSpeed = rockerAmplitude
      * inputAngularFrequency * Math.cos(phaseAngle);
    const openPulleyAngle = pulleyRatio * rockerAngle;
    const crossedPulleyAngle = -pulleyRatio * rockerAngle;
    const openPulleyAngularSpeed = pulleyRatio * rockerAngularSpeed;
    const crossedPulleyAngularSpeed = -pulleyRatio * rockerAngularSpeed;
    const rockerTravel = accumulatedRockerTravel(phase, rockerAngle);
    // The extra carrier travel lets an overrunning toe finish its finite drop.
    // On reversal the new carrier takes up that clearance before driving.
    const flywheelAngle = phase < .25 ? openPulleyAngle
      : phase < .75 ? Math.max(carrierAmplitude, crossedPulleyAngle + strokeAdvance)
        : Math.max(carrierAmplitude + strokeAdvance, openPulleyAngle + 2 * strokeAdvance);
    const openDriving = phase < .25 || (phase >= .75
      && openPulleyAngle + 2 * strokeAdvance >= carrierAmplitude + strokeAdvance - 1e-13);
    const crossedDriving = phase >= .25 && phase < .75
      && crossedPulleyAngle + strokeAdvance >= carrierAmplitude - 1e-13;
    const flywheelAngularSpeed = openDriving ? Math.max(0, openPulleyAngularSpeed)
      : crossedDriving ? Math.max(0, crossedPulleyAngularSpeed) : 0;
    const atHandoff = !openDriving && !crossedDriving;
    const openPawl = pawlState(
      flywheelAngle,
      openPulleyAngle,
      openDriving,
      phase >= .25 && phase < .75,
      flywheelAngle - openPulleyAngle,
    );
    const crossedPawl = pawlState(
      flywheelAngle,
      crossedPulleyAngle,
      crossedDriving,
      phase < .25 || phase >= .75,
      flywheelAngle - crossedPulleyAngle + (phase < .25 ? strokeAdvance : -strokeAdvance),
    );
    openPawl.liftAngle = droppedLift(time, 'open');
    crossedPawl.liftAngle = droppedLift(time, 'crossed');
    const openCurve = openCurveAtAngle(rockerAngle);
    const crossedCurve = crossedCurveAtAngle(rockerAngle);
    return {
      activeDrive: atHandoff
        ? 'output-dwell-during-finite-pawl-take-up'
        : openDriving
          ? 'open-band-C-pawl-driving'
          : 'crossed-band-D-pawl-driving',
      crossedBandMaterialTravel: -sectorRadius * rockerAngle,
      crossedCurve,
      crossedPawl,
      crossedPulleyAngle,
      crossedPulleyAngularSpeed,
      cycleTime,
      flywheelAngle,
      flywheelAngularSpeed,
      openBandMaterialTravel: sectorRadius * rockerAngle,
      openCurve,
      openPawl,
      openPulleyAngle,
      openPulleyAngularSpeed,
      phase,
      rockerAngle,
      rockerAngularSpeed,
      rockerTravel,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rockingSector.rotation.z = state.rockerAngle;
    openCarrier.rotation.z = state.openPulleyAngle;
    crossedCarrier.rotation.z = state.crossedPulleyAngle;
    flywheelRotor.rotation.z = state.flywheelAngle;
    // Both pawls of a pulley are six teeth apart, so they share one lift.
    for (const [carrier, pawlState] of [
      [openCarrier, state.openPawl],
      [crossedCarrier, state.crossedPawl],
    ]) {
      for (const pawl of carrier.userData.pawls ?? [carrier.userData.pawl]) {
        pawl.rotation.z = pawl.userData.baseAngle + pawlState.liftAngle;
      }
      for (const index of carrier.userData.contactIndices ?? [carrier.userData.contactIndex]) {
        index.visible = pawlState.active;
      }
    }
    openBand.userData.setCurve(state.openCurve);
    openBand.userData.updateDistance(state.openBandMaterialTravel);
    crossedBand.userData.setCurve(state.crossedCurve);
    crossedBand.userData.updateDistance(
      state.crossedBandMaterialTravel,
    );
    root.userData.contacts = {
      crossedPawlToFastRatchet: {
        active: state.crossedPawl.active,
        contactError: state.crossedPawl.contactError,
        relativeToothPhase: state.crossedPawl.relativeToothPhase,
      },
      openPawlToFastRatchet: {
        active: state.openPawl.active,
        contactError: state.openPawl.contactError,
        relativeToothPhase: state.openPawl.relativeToothPhase,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'rocking-semicircular-sector-open-and-crossed-anchored-bands-dual-loose-pulley-ratchet-flywheel-rectifier',
    blocks: {
      bandAnchorsLocal,
      crossedBand,
      crossedBandMarkers: crossedBand.userData.markers,
      crossedCarrier,
      crossedCarrierFaceIndex: crossedCarrier.userData.faceIndex,
      crossedPawl: crossedCarrier.userData.pawl,
      crossedPawlContactIndex: crossedCarrier.userData.contactIndex,
      crossedRatchet,
      flywheelIndex,
      flywheelRim,
      flywheelRotor,
      flywheelSpokes,
      frame,
      openBand,
      openBandMarkers: openBand.userData.markers,
      openCarrier,
      openCarrierFaceIndex: openCarrier.userData.faceIndex,
      openPawl: openCarrier.userData.pawl,
      openPawlContactIndex: openCarrier.userData.contactIndex,
      openRatchet,
      pivotPin,
      rockerIndex,
      rockingSector,
      sectorArc,
      shaft,
      topLever,
    },
    constraintResiduals: {
      crossedBandInitialLength:
        initialCrossedCurve.getLength() - crossedBandLength,
      openBandInitialLength:
        initialOpenCurve.getLength() - openBandLength,
      // The flywheel's four spokes and twelve teeth repeat every quarter turn.
      outputCycleClosure: positiveModulo(outputAdvancePerCycle, Math.PI / 2),
      pulleyRatioClosure:
        loosePulleyRadius * pulleyRatio - sectorRadius,
      upperWrapSum:
        initialOpenCurve.userData.upperWrapLength
          - 2 * sectorRadius * openUpperBaseWrap,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: ['oscillation angle of fulcrumed semicircular piece A'],
      note:
        'the two fixed-length bands impose equal and opposite loose-pulley angles; opposed one-way pawls alternately couple the positive-moving pulley to two ratchets fast on the common flywheel shaft',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'piece A and its lever are one rigid oscillator about fixed fulcrum a',
        'bands C and D are inextensible, remain tangent to equal loose pulleys, and occupy separate axial planes',
        'the crossed band uses equal and opposite crossover lifts so its two free spans cannot intersect',
        'pawls and ratchets are rigid and frictionless; the active carrier matches shaft speed while the inactive pawl overruns',
        'flywheel inertia, torque ripple, belt mass and compliance, impact and friction are omitted; dimensions, sinusoidal input, one-turn display ratio, materials, depth and camera are reconstruction decisions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      treatment:
        'constant-length anchored bands, no-slip carrier angles, finite geometric pawl contact with prescribed return and analytic take-up; no passive force solution',
    },
    fidelity: 'authored',
    geometry: {
      carrierOvertravel,
      carrierAmplitude,
      crossedBandLength,
      crossedPlaneZ,
      flywheelRadius,
      lowerCenter: lowerCenter.clone(),
      loosePulleyRadius,
      openBandLength,
      openPlaneZ,
      outputAdvancePerCycle,
      pawlMaximumLift,
      pulleyRatio,
      ratchetOuterRadius,
      ratchetRootRadius,
      ratchetToothCount,
      ratchetToothPitch,
      rockerAmplitude,
      sectorCenter: sectorCenter.clone(),
      sectorRadius,
      anchorLift,
      bandThickness,
      bandWidth,
      crossShift,
      crossedUpperBaseWrap,
      openUpperBaseWrap,
      strokeAdvance,
    },
    mechanism:
      'one-fulcrumed-semicircular-piece-A-two-simultaneous-fixed-end-bands-C-open-and-D-crossed-two-coaxial-loose-pulley-pawl-carriers-two-ratchets-fast-on-one-continuously-positive-flywheel-B-shaft',
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'the official Movement 390 page exposes no canvas animation; topology, belt routing, clutching sequence, and output direction are reconstructed from Brown\'s public-domain engraving and description',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate390: {
        crossedBandLabelPixels: [231, 258],
        flywheelCenterPixels: [260, 329],
        flywheelOuterRadiusPixels: 132,
        fulcrumAPixels: [253, 94],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 9,
        openBandLabelPixels: [346, 294],
        pieceAOuterArcPixels: {
          bottomY: 254,
          leftX: 96,
          rightX: 410,
          topY: 95,
        },
        pulleyAndRatchetRegionPixels: {
          maximumX: 315,
          maximumY: 376,
          minimumX: 210,
          minimumY: 271,
        },
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'semicircular piece A is rigid with a lever working about fulcrum a',
          'the ends of bands C and D are attached to A and run around two pulleys loose on the flywheel shaft',
          'band C is open and band D is crossed',
          'each loose pulley carries a pawl engaging its own ratchet wheel fast on the flywheel shaft',
          'the two pawls act on opposite directions of A and yield continuous one-direction shaft rotation',
        ],
        engravingEvidence:
          'the plate places the semicircular yoke above two superposed band paths and two coaxial loose-pulley/ratchet layers at the center of flywheel B',
        reconstructionDisclosure:
          'no official animation is available; the exact compensated sector wraps, tangent paths, crossover separation, radii, oscillation law and amplitude, twelve-tooth ratchets, one-turn display closure, pawl lift, axial stack, frame, materials, indexes, and camera are independently engineered',
      },
      officialPage: movement.sourceUrl,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      demonstrationPeriod: cycleDuration,
      events: {
        crossedPawlTakesDrive: cycleDuration * (.25 + Math.acos(1 - carrierOvertravel / carrierAmplitude) / FULL_TURN),
        crossedCarrierReverses: cycleDuration * .25,
        openPawlRetakesDrive: cycleDuration * (.75 + Math.acos(1 - carrierOvertravel / carrierAmplitude) / FULL_TURN),
        openCarrierReverses: cycleDuration * .75,
        oneInputOscillationAndOutputTurn: cycleDuration,
      },
      note:
        'one oscillation gives one positive output turn with brief stationary take-up after each carrier reversal; finite drop is prescribed and impact at pickup is omitted',
    },
    transmission: {
      bandLengthLaw:
        'each band has fixed lower wrap and tangent spans plus upper sector wraps R*(base+alpha) and R*(base-alpha), whose sum is constant',
      beltDirectionLaw:
        'open C gives theta_C=(R/r)*alpha while crossed D gives theta_D=-(R/r)*alpha',
      outputLaw:
        'theta_B follows the positive carrier after finite take-up; omega_B is either abs(omega_carrier) or zero during the two short dwells',
      pawlLaw:
        'a carrier with positive angular speed takes up the finite drop allowance before its pawl seats; the opposite pawl follows the finite tooth envelope',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.48, -1.87, -1.15),
    new THREE.Vector3(2.48, 3.28, 1.15),
  );
  root.userData.cameraDistanceScale = 1.17;
  root.userData.groundFloorY = -1.74;
  correctDualBandInterfaces(root);
  // The loose hubs end short of the fast ratchet wheels beside them.
  for (const carrier of [openCarrier, crossedCarrier]) {
    const {hub} = carrier.userData;
    hub.geometry.dispose();
    hub.geometry = boredAxialCylinder(0.13, 0.108, 0.21);
  }
  // Identical loose pulleys: a flat-bottomed groove wide enough for the
  // crossed band's shift across it (and the open band centred in it), between
  // two flanges. The old flange ring shared the rim's outer surface.
  for (const carrier of [openCarrier, crossedCarrier]) {
    const { pulley, groove } = carrier.userData;
    const halfGroove = crossShift + bandWidth / 2 + 0.01;
    const floor = loosePulleyRadius - bandThickness / 2 - 0.005;
    pulley.geometry.dispose();
    pulley.geometry = boredLatheGeometry([
      { axial: -0.11, radial: 0.545 },
      { axial: -halfGroove, radial: 0.545 },
      { axial: -halfGroove, radial: floor },
      { axial: halfGroove, radial: floor },
      { axial: halfGroove, radial: 0.545 },
      { axial: 0.11, radial: 0.545 },
    ], 0.108, 128);
    pulley.userData.grooveFloorRadius = floor;
    pulley.userData.grooveHalfWidth = halfGroove;
    groove.removeFromParent();
    groove.geometry.dispose();
  }
  // The fulcrum pin spans the deeper bar (correctDualBandInterfaces cut it
  // for the old thin lever).
  pivotPin.geometry.dispose();
  pivotPin.geometry = new THREE.CylinderGeometry(0.13, 0.13, rimFront - rimBack + 0.10, 32)
    .rotateX(Math.PI / 2);
  pivotPin.rotation.set(0, 0, 0);
  pivotPin.position.z = (rimFront + rimBack) / 2;
  install390Pawls(root);
  finishAlternatingDrive(root, update, cycleDuration);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.15, 0.12, 12),
    root,
    update,
  };
}

export function createAuthoredDualBandRatchetMovement(movement) {
  if (movement.id !== 390) return null;
  return dualBandOscillationRectifier(movement);
}
