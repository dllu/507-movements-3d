import * as THREE from 'three';

const cubic = (a, b, c, d, count) => Array.from({ length: count + 1 }, (_, i) => {
  const t = i / count, u = 1 - t;
  return new THREE.Vector2(u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y);
});

// A flat pawl hung from the carrier pin: a round boss bored for the pin, two
// smooth sides and a wedge tip whose working face lies along the tooth's
// radial face and whose underside lies along the preceding tooth's back, so
// at the seat the tip fills the root. It is biased onto the teeth and always
// rests on them; the teeth alone decide its lift (no stop).
export function makeRatchetFollower() {
  const p = { teeth: 18, rootRadius: 0.40, tipRadius: 0.46, faceAngle: Math.PI / 2 + 0.14,
    contactClearance: 0.000005, bossRadius: 0.05, pawlLength: 0.22, pawlLean: Math.PI / 6,
    faceReach: 0.075, heelReach: 0.05 };
  const pitch = 2 * Math.PI / p.teeth, outline = [];
  for (let tooth = 0; tooth < p.teeth; tooth += 1) {
    const angle = p.faceAngle + tooth * pitch;
    outline.push(new THREE.Vector2(p.rootRadius * Math.cos(angle), p.rootRadius * Math.sin(angle)));
    for (let i = 0; i <= 8; i += 1) {
      const a = angle + 0.10 * pitch * i / 8;
      outline.push(new THREE.Vector2(p.tipRadius * Math.cos(a), p.tipRadius * Math.sin(a)));
    }
  }
  const polar = (r, a) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  const root = polar(p.rootRadius, p.faceAngle);
  const face = polar(1, p.faceAngle), back = polar(p.tipRadius, p.faceAngle - 0.9 * pitch).sub(root).normalize();
  // The pin stands behind the tip, the pawl leaning pawlLean off the tangent:
  // pushing seats the tip, gravity (the pin is above the tip at every carrier
  // angle) holds it on the teeth, and lifting swings the tip mostly outward.
  const tangent = polar(1, p.faceAngle + Math.PI / 2), axis = tangent.clone().multiplyScalar(-Math.cos(p.pawlLean))
    .addScaledVector(face, Math.sin(p.pawlLean));
  const pivot = root.clone().addScaledVector(axis, p.pawlLength);
  p.armRadius = pivot.length(); p.armAngle = Math.atan2(-pivot.x, pivot.y);
  const bisector = face.clone().add(back).normalize();
  const tip = root.clone().addScaledVector(bisector, p.contactClearance / Math.sin(face.angle() - back.angle()) * 2);
  const valleyAngle = face.angle() - back.angle();
  const W = tip.clone().addScaledVector(face, p.faceReach), U = tip.clone().addScaledVector(back, p.heelReach);
  const normal = new THREE.Vector2(-axis.y, axis.x), upper = pivot.clone().addScaledVector(normal, p.bossRadius),
    lower = pivot.clone().addScaledVector(normal, -p.bossRadius);
  const heel = back.clone().rotateAround(new THREE.Vector2(), 0.7);
  const lowerSide = cubic(U, U.clone().addScaledVector(heel, 0.04), lower.clone().addScaledVector(axis, -0.06), lower, 24);
  const upperSide = cubic(upper, upper.clone().addScaledVector(axis, -0.07), W.clone().addScaledVector(face, 0.03).addScaledVector(axis, 0.03), W, 24);
  const start = Math.atan2(-normal.y, -normal.x);
  const boss = Array.from({ length: 33 }, (_, i) => pivot.clone().add(polar(p.bossRadius, start + Math.PI * i / 32)));
  // Counterclockwise pawl outline in the carrier frame at the seat.
  const pawlOutline = [tip, ...lowerSide.slice(0, -1), ...boss.slice(0, -1), ...upperSide];
  const densify = (points, closed, step) => {
    const result = [];
    for (let i = 0; i < points.length - (closed ? 0 : 1); i += 1) {
      const a = points[i], b = points[(i + 1) % points.length], n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
      for (let k = 0; k < n; k += 1) result.push(a.clone().lerp(b, k / n));
    }
    if (!closed) result.push(points.at(-1).clone());
    return result;
  };
  // Working points: the pawl's lower skin (below the crest circle plus a
  // margin) and the four teeth round the seat, in their own frames.
  const pawlSkin = densify(pawlOutline, true, 0.0025).filter((v) => v.length() < p.tipRadius + 0.03);
  const local = [];
  for (let tooth = -3; tooth <= 1; tooth += 1) {
    const start = ((tooth % p.teeth) + p.teeth) % p.teeth * 10;
    for (let i = 0; i < 10; i += 1) local.push(outline[(start + i) % outline.length].clone());
  }
  const toothSkin = local;
  const segmentsOf = (points, closed) => points.slice(0, closed ? points.length : -1).map((a, i) => [a, points[(i + 1) % points.length]]);
  const pawlSegments = segmentsOf(pawlOutline, true).filter(([a, b]) => Math.min(a.length(), b.length()) < p.tipRadius + 0.03);
  const signedDistance = (q, segments, polygon) => {
    let squared = Infinity, inside = false;
    for (const [a, b] of segments) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = THREE.MathUtils.clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      squared = Math.min(squared, (q.x - a.x - t * dx) ** 2 + (q.y - a.y - t * dy) ** 2);
    }
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return (inside ? -1 : 1) * Math.sqrt(squared);
  };
  // The tooth region used for inside tests: the local teeth closed through
  // the wheel centre.
  const toothRegion = [...local, new THREE.Vector2(0, 0)];
  const toothRegionSegments = segmentsOf(toothRegion, true).slice(0, local.length - 1);
  const pose = (v, angle, relativeAngle) => v.clone().sub(pivot).rotateAround(new THREE.Vector2(), angle).add(pivot)
    .rotateAround(new THREE.Vector2(), relativeAngle);
  const wrap = (relativeAngle) => THREE.MathUtils.euclideanModulo(relativeAngle + pitch / 2, pitch) - pitch / 2;
  // Signed clearance of the pawl against the real teeth at a pawl angle
  // (0 = seated, negative = lifted) and a pawl-to-wheel relative angle.
  const clearanceAt = (angle, relativeAngle) => {
    const phase = wrap(relativeAngle);
    let minimum = Infinity;
    for (const v of pawlSkin) minimum = Math.min(minimum, signedDistance(pose(v, angle, phase), toothRegionSegments, toothRegion));
    const inverse = (v) => v.clone().rotateAround(new THREE.Vector2(), -phase).sub(pivot).rotateAround(new THREE.Vector2(), -angle).add(pivot);
    for (const v of toothSkin) minimum = Math.min(minimum, signedDistance(inverse(v), pawlSegments, pawlOutline));
    return minimum;
  };
  // Gravity holds the pawl on the teeth: its angle is the least lift that
  // clears them. No point of the working skin lies farther than lever from
  // the pin, so a step of (penetration / lever) cannot pass the first clear
  // angle; bisection then finds it.
  const lever = Math.max(...pawlSkin.map((v) => v.distanceTo(pivot)), ...local.map((v) => v.distanceTo(pivot)));
  const angleAt = (relativeAngle) => {
    let angle = 0, clearance = clearanceAt(0, relativeAngle);
    if (clearance >= -1e-12) return 0;
    let blocked = 0;
    while (clearance < 0 && angle > -1) {
      blocked = angle; angle = Math.max(-1, angle - Math.max(0.0005, -clearance / lever));
      clearance = clearanceAt(angle, relativeAngle);
    }
    let clear = angle;
    for (let i = 0; i < 26; i += 1) {
      const middle = (clear + blocked) / 2;
      if (clearanceAt(middle, relativeAngle) >= 0) clear = middle; else blocked = middle;
    }
    return clear;
  };
  const restAngle = 0, length = tip.distanceTo(pivot);
  return { parameters: p, pitch, outline, pawlOutline, pivot, tip, root, W, U, valleyAngle, length, restAngle,
    clearanceAt, angleAt };
}

export function makeRatchetBevelMotion({ amplitude, frequency = 0.8 } = {}) {
  const follower = makeRatchetFollower(), pitch = follower.pitch;
  // Four teeth per half-stroke give Brown's continuous one-direction drive.
  // The stroke overtravels 0.15 pitch, so each idle pawl drops fully into a
  // root before the reversal and slides back to seat in it (lost motion)
  // before it drives. Other amplitudes are supported likewise.
  const inputAmplitude = amplitude ?? (2 + 0.075) * pitch;
  const teethPerHalfStroke = Math.floor(2 * inputAmplitude / pitch + 1e-10);
  const halfStrokeAdvance = teethPerHalfStroke * pitch;
  const backlashTravel = 2 * inputAmplitude - halfStrokeAdvance;
  const cycleDuration = 2 * Math.PI / frequency, inertia = 0.1;
  const resistingTorque = inertia * inputAmplitude * frequency ** 2 * 1.4;
  const stateAt = (time) => {
    const phase = frequency * time, inputAngle = inputAmplitude * Math.sin(phase);
    const inputAngularSpeed = inputAmplitude * frequency * Math.cos(phase);
    const inputAcceleration = -inputAmplitude * frequency ** 2 * Math.sin(phase);
    const stroke = Math.floor((phase - Math.PI / 2) / Math.PI + 1e-12);
    const side = THREE.MathUtils.euclideanModulo(stroke, 2) === 0 ? 'left' : 'right';
    const sign = side === 'right' ? 1 : -1, carrierAngle = sign * inputAngle;
    const travelled = carrierAngle + inputAmplitude;
    const driving = teethPerHalfStroke > 0 && travelled >= backlashTravel - 1e-12;
    const advance = inputAmplitude + stroke * halfStrokeAdvance + Math.max(0, travelled - backlashTravel);
    const speed = driving ? Math.max(0, sign * inputAngularSpeed) : 0;
    const acceleration = driving ? sign * inputAcceleration : 0;
    const rightRelativeAngle = inputAngle - advance, leftRelativeAngle = -inputAngle - advance;
    return { time, phase, stroke, inputAngle, inputAngularSpeed, inputAcceleration, advance,
      outputAngle: -advance, outputAngularSpeed: -speed, outputAcceleration: -acceleration,
      activeSide: driving && Math.abs(inputAngularSpeed) > 1e-10 ? side : 'none', driving,
      rightRelativeAngle, leftRelativeAngle,
      rightPawlAngle: follower.angleAt(rightRelativeAngle), leftPawlAngle: follower.angleAt(leftRelativeAngle),
      resistingTorque: driving ? resistingTorque : 0,
      driveTorque: driving ? resistingTorque + inertia * acceleration : 0 };
  };
  return { follower, parameters: { inputAmplitude, frequency, cycleDuration, teethPerHalfStroke,
    halfStrokeAdvance, backlashTravel, inertia, resistingTorque }, stateAt };
}
