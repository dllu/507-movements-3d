import { correctEndlessMaintainingChain } from './maintaining-clock-parts.js';
import * as THREE from 'three';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import clickPaths from './baked/maintaining-clock-clicks.js';
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

// Click and ratchet at p, rebuilt as one working pair. Each steep tooth face
// runs from its root nearly along the click's swing (undercut 10 degrees so
// the load draws the click into the root), and the back of the tooth runs
// straight to the next root. The click is one flat plate: a boss bored for
// its pin and a straight tapered finger whose toe fills the valley, its
// working face along the steep face and its underside along the back, meeting
// in a small rounded nose. At every locked pose the nose sits in a root with
// the working face on the tooth face. The click rests on the wheel under its
// own weight: its angle is the highest contact of the two outlines, found
// exactly (vertex circles against edges both ways) and baked offline.
const CLICK_NOSE_RADIUS = 0.012;
const CLICK_FACE_UNDERCUT = THREE.MathUtils.degToRad(10);
// After each winding the wheel runs this far past the seat (the click drops
// into the root and rides a little up the next back), then the chain load
// turns it back onto the click at the start of going.
const RATCHET_OVERSHOOT = 0.05;
const RATCHET_ROOT_RATIO = 0.74;
// The click's eye clears the tooth tips it overhangs.
const CLICK_EYE_RADIUS = 0.1;
const CLICK_PIN_RADIUS = 0.05;
const CLICK_ARM_HALF_WIDTH = 0.05;

function seatClickAndRatchet(root) {
  const b = root.userData.blocks;
  const old = b.finiteClicks[0];
  const wheel = old.wheel;
  const profile = wheel.userData.ratchetProfile;
  const { radius, bore, teeth, depth } = profile;
  // Plate: Brown's ten saw teeth are cut deep, roots at about three
  // quarters of the tip radius.
  const rootRadius = radius * RATCHET_ROOT_RATIO;
  const pitch = FULL_TURN / teeth;
  const pivot = old.pivot;
  const turn = (q, a) => [q[0] * Math.cos(a) - q[1] * Math.sin(a), q[0] * Math.sin(a) + q[1] * Math.cos(a)];
  const sub = (a, c) => [a[0] - c[0], a[1] - c[1]];
  const add = (a, c) => [a[0] + c[0], a[1] + c[1]];
  const scale = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, c) => a[0] * c[0] + a[1] * c[1];
  const unit = (a) => scale(a, 1 / Math.hypot(a[0], a[1]));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // Seat: the root at Brown's click angle (top of p, a little left).
  const seatAngle = Math.atan2(0.73, -0.12);
  const root0 = [rootRadius * Math.cos(seatAngle), rootRadius * Math.sin(seatAngle)];
  const arm = sub(root0, pivot);
  const clickLength = Math.hypot(...arm);
  const ahead = [-Math.sin(seatAngle), Math.cos(seatAngle)];
  let swing = unit([-arm[1], arm[0]]);
  if (dot(swing, root0) < 0) swing = scale(swing, -1);
  const undercutSign = Math.sign(dot(turn(swing, 1e-3), ahead) - dot(swing, ahead));
  const face = turn(swing, undercutSign * CLICK_FACE_UNDERCUT);
  const along = dot(root0, face);
  const faceLength = -along + Math.sqrt(along ** 2 - rootRadius ** 2 + radius ** 2);
  const tip0 = add(root0, scale(face, faceLength));
  const tipLead = wrap(Math.atan2(tip0[1], tip0[0]) - seatAngle);
  const outline = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = seatAngle + i * pitch;
    outline.push([rootRadius * Math.cos(a), rootRadius * Math.sin(a)]);
    outline.push([radius * Math.cos(a + tipLead), radius * Math.sin(a + tipLead)]);
  }
  wheel.geometry.dispose();
  wheel.geometry = plate(polygonClipping.difference(poly(outline), poly(circle([0, 0], bore, 64))), -depth / 2, depth / 2);
  wheel.userData.ratchetProfile = { ...profile, outline, rootRadius, tipLead, seatAngle, faceUndercut: CLICK_FACE_UNDERCUT };

  // Click toe in the seated valley (wheel-relative coordinates at A = 0).
  const previousTip = outline.at(-1);
  const back = unit(sub(previousTip, root0));
  const half = Math.acos(dot(face, back)) / 2;
  const bisector = unit(add(face, back));
  const noseCenter = add(root0, scale(bisector, CLICK_NOSE_RADIUS / Math.sin(half)));
  // 0.0005 off the tooth face, so the two outlines only touch.
  const faceEnd = add(add(root0, scale(face, 0.8 * faceLength)), scale([-face[1], face[0]], 0.0005 * Math.sign(dot([-face[1], face[0]], bisector))));
  const backEnd = add(root0, scale(back, 0.07));
  const hullOf = (points) => {
    const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const chain = (list) => {
      const out = [];
      for (const point of list) {
        while (out.length > 1 && cross(out.at(-2), out.at(-1), point) <= 0) out.pop();
        out.push(point);
      }
      return out.slice(0, -1);
    };
    return [...chain(sorted), ...chain([...sorted].reverse())];
  };
  // Brown's click: an arm on a circular arc concentric with p (so it rides
  // clear over the tooth between its eye and its root), ending in a toe
  // that drops into the root with its working face on the tooth face and
  // its underside on the back of the tooth behind.
  const armRadius = Math.hypot(...pivot);
  const armHalfWidth = CLICK_ARM_HALF_WIDTH;
  const armStart = Math.atan2(pivot[1], pivot[0]);
  const armEnd = Math.atan2(tip0[1], tip0[0]);
  const armSweep = wrap(armEnd - armStart);
  const armBand = [];
  for (let i = 0; i <= 48; i += 1) {
    const a = armStart + armSweep * i / 48;
    armBand.push([(armRadius + armHalfWidth) * Math.cos(a), (armRadius + armHalfWidth) * Math.sin(a)]);
  }
  for (let i = 48; i >= 0; i -= 1) {
    const a = armStart + armSweep * i / 48;
    armBand.push([(armRadius - armHalfWidth) * Math.cos(a), (armRadius - armHalfWidth) * Math.sin(a)]);
  }
  const armEndOuter = [(armRadius + armHalfWidth) * Math.cos(armEnd), (armRadius + armHalfWidth) * Math.sin(armEnd)];
  const armEndInner = [(armRadius - armHalfWidth) * Math.cos(armEnd), (armRadius - armHalfWidth) * Math.sin(armEnd)];
  // The toe is a solid wedge: it fills the corner between the arm and the
  // tooth behind, lying along that tooth's back.
  const toeHeel = add(add(root0, scale(back, 0.16)), scale(bisector, 0.002));
  const armJoin = [(armRadius - armHalfWidth) * Math.cos(armEnd - 0.2 * armSweep),
    (armRadius - armHalfWidth) * Math.sin(armEnd - 0.2 * armSweep)];
  const finger = hullOf([
    armEndOuter, armEndInner, armJoin, faceEnd, backEnd, toeHeel,
    ...circle(noseCenter, CLICK_NOSE_RADIUS, 48),
  ]);
  const seatRotation = Math.atan2(arm[1], arm[0]);
  const worldShape = polygonClipping.difference(
    polygonClipping.union(poly(finger), poly(armBand), poly(circle(pivot, CLICK_EYE_RADIUS, 64)),
      poly(circle(armEndOuter.map((v, i) => (v + armEndInner[i]) / 2), armHalfWidth, 32))),
    poly(circle(pivot, CLICK_PIN_RADIUS + 0.002, 48)),
  );
  const local = worldShape.map((polygon) => polygon.map((ring) => ring.map((q) => turn(sub(q, pivot), -seatRotation))));
  old.body.geometry.dispose();
  old.body.geometry = plate(local, -0.06, 0.06);
  old.body.userData.role = 'flat-click-with-valley-toe';
  // A short fixed stud through the click's eye only (no long rear pin).
  const clickZ = old.group.position.z;
  old.pin.geometry.dispose();
  old.pin.geometry = new THREE.CylinderGeometry(CLICK_PIN_RADIUS, CLICK_PIN_RADIUS, 0.16, 32);
  old.pin.position.z = clickZ + 0.01;
  old.pin.userData.role = 'short-fixed-click-stud-through-eye';
  // Brown marks each pulley's arbor with a dot: short fixed arbors through
  // the hubs (the undrawn clock frame that carries them is not shown).
  for (const [role, pulley] of [['fixed-arbor-p', b.ratchetPulley], ['going-wheel-arbor-P', b.goingPulley]]) {
    let axle = null;
    root.traverse((object) => { if (object.userData.role === role) axle = object; });
    const hub = pulley.userData.workingHub;
    hub.geometry.computeBoundingBox();
    const hubBox = hub.geometry.boundingBox;
    const back = pulley.position.z + hubBox.min.y - 0.02;
    const front = pulley.position.z + hubBox.max.y + 0.02;
    axle.geometry.dispose();
    axle.geometry = new THREE.CylinderGeometry(0.124, 0.124, front - back, 40);
    axle.position.z = (front + back) / 2;
    root.add(axle);
    b[role === 'fixed-arbor-p' ? 'arborP' : 'arborBigP'] = axle;
  }

  // Exact rest angle on the wheel.
  const clickRing = local[0][0].slice(0, -1);
  const toe = clickRing.filter((q) => Math.hypot(...add(pivot, turn(q, seatRotation))) < radius + 0.05);
  const toeEdges = [];
  for (let i = 0; i < clickRing.length; i += 1) {
    const q = clickRing[i], r = clickRing[(i + 1) % clickRing.length];
    if (toe.includes(q) || toe.includes(r)) toeEdges.push([q, r]);
  }
  const noseRadial = (rotation) => Math.hypot(...add(pivot, turn([clickLength, 0], rotation)));
  const liftSign = Math.sign(noseRadial(seatRotation + 1e-4) - noseRadial(seatRotation));
  const circleSegment = (center, r, a, c, callback) => {
    const d = sub(c, a), f = sub(a, center);
    const A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - r * r, disc = B * B - 4 * A * C;
    if (disc < 0 || A === 0) return;
    const sq = Math.sqrt(disc);
    for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) if (t >= 0 && t <= 1) callback(add(a, scale(d, t)));
  };
  const angleAt = (wheelAngle) => {
    const world = outline.map((q) => turn(q, wheelAngle));
    const near = [];
    for (let i = 0; i < world.length; i += 1) {
      const q = world[i];
      if (Math.abs(wrap(Math.atan2(q[1], q[0]) - seatAngle)) < 1.2) near.push([q, world[(i + 1) % world.length]]);
    }
    let lift = -0.3;
    const take = (rotation) => {
      const candidate = liftSign * wrap(rotation - seatRotation);
      if (candidate > lift && candidate < 0.6) lift = candidate;
    };
    for (const q of toe) {
      const r = Math.hypot(...q), base = Math.atan2(q[1], q[0]);
      for (const [a, c] of near) circleSegment(pivot, r, a, c, (x) => take(Math.atan2(x[1] - pivot[1], x[0] - pivot[0]) - base));
    }
    for (const [q] of near) {
      const v = sub(q, pivot), r = Math.hypot(...v), base = Math.atan2(v[1], v[0]);
      for (const [a, c] of toeEdges) circleSegment([0, 0], r, a, c, (x) => take(base - Math.atan2(x[1], x[0])));
    }
    return seatRotation + liftSign * lift;
  };
  const bakeKey = '320-p';
  // The click's own outline is part of the signature, so a changed click
  // cannot play back a stale path.
  const bakeSignature = { pivot, length: clickLength, base: seatRotation, sign: liftSign, outline,
    clickOutline: clickRing.map((q) => [Number(q[0].toFixed(9)), Number(q[1].toFixed(9))]) };
  const path = clickPaths[bakeKey];
  const baked = path && JSON.stringify(path.signature) === JSON.stringify(bakeSignature);
  const playbackAngleAt = baked ? (angle) => {
    const phase = (((angle / path.pitch) % 1) + 1) % 1, coordinate = phase * path.phaseScale, knots = path.knots;
    let lo = 0, hi = knots.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (knots[mid][0] <= coordinate) lo = mid; else hi = mid; }
    const a = knots[lo], c = knots[hi], t = (coordinate - a[0]) / (c[0] - a[0]);
    return a[1] + t * (c[1] - a[1]);
  } : angleAt;
  const follower = {
    ...old, outline, length: clickLength, base: seatRotation, sign: liftSign, angleAt, playbackAngleAt, bakeKey, bakeSignature,
    seatRotation, noseRadius: CLICK_NOSE_RADIUS,
    update(angle) { old.group.rotation.z = playbackAngleAt(angle); },
  };
  b.finiteClicks = [follower];
  // The overshoot and settle, as a wheel angle added to the chain's p.
  const slipAt = (phase) => (phase < 0.5
    ? RATCHET_OVERSHOOT * (1 - smoothstep(Math.min(1, phase / 0.05)))
    : RATCHET_OVERSHOOT * smoothstep((phase - 0.5) / 0.5));
  root.userData.ratchetSlipAt = slipAt;
  root.userData.updateClockInterfaces = (state) => {
    const angle = state.pulleys.A.angle + slipAt(state.phase);
    setRotorAngle(b.ratchetPulley, angle);
    follower.update(angle);
    state.renderedRatchetAngle = angle;
  };
  root.userData.reconstructionNote = 'The endless chain preserves its length and no-slip travel through the prescribed winding cycle. Grooves and moving journals have finite clearances. The click rests on the ratchet by its own weight (exact outline contact, baked offline); each winding carries p 0.05 rad past the seat so the click drops fully into the root, and p then settles back onto the click at the start of going. That settle is applied to p alone: the chain\'s matching take-up at w is not shown. Weight forces, friction and impact are not dynamically validated.';
  Object.assign(root.userData.geometry, {
    clickNoseRadius: CLICK_NOSE_RADIUS,
    clickFaceUndercut: CLICK_FACE_UNDERCUT,
    ratchetOvershoot: RATCHET_OVERSHOOT,
    ratchetRootRadius: rootRadius,
    ratchetTipLead: tipLead,
    ratchetSeatAngle: seatAngle,
    clickSeatRotation: seatRotation,
    clickLength,
  });
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
  // Top face just below the flange of L (radius 1.25), not cut into it.
  largeWeight.position.set(0, -1.80, -0.05);
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

  // Brown draws the "rope or chain" as plain cord lines: the shared laid
  // rope, whose moving lay shows its travel (no white markers).
  const chain = makeDynamicMovingBelt(referencePath.curve, {
    closed: true,
    color: PALETTE.ink,
    laid: true,
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

  // Plate: the click's eye is inside p's rim, at (0.47, 0.76) of its radius.
  const pawlPivot = referencePath.centers.A.clone().add(
    new THREE.Vector3(0.47, 0.76, 0.34),
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

  // Brown draws no winding handle; part b is simply pulled down. The empty
  // group only keeps the winding-point tracker available for inspection (an
  // earlier ring threaded on the chain passed into the chain itself).
  const windingHandle = new THREE.Group();
  windingHandle.userData.role = 'undrawn-winding-point-on-part-b';
  windingHandle.visible = false;

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
  seatClickAndRatchet(root);
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
