import * as THREE from 'three';

export function makeRatchetFollower() {
  const p = { teeth: 18, rootRadius: 0.40, tipRadius: 0.46, armRadius: 0.61,
    noseRadius: 0.024, contactClearance: 0.000005, contactRadius: 0.445,
    faceAngle: Math.PI / 2 + 0.14, heelLength: 0.055, heelRadius: 0.012, stopRadius: 0.012 };
  const pitch = 2 * Math.PI / p.teeth, outline = [];
  for (let tooth = 0; tooth < p.teeth; tooth += 1) {
    const angle = p.faceAngle + tooth * pitch;
    outline.push(new THREE.Vector2(p.rootRadius * Math.cos(angle), p.rootRadius * Math.sin(angle)));
    for (let i = 0; i <= 8; i += 1) {
      const a = angle + 0.10 * pitch * i / 8;
      outline.push(new THREE.Vector2(p.tipRadius * Math.cos(a), p.tipRadius * Math.sin(a)));
    }
  }
  const radius = p.noseRadius + p.contactClearance;
  const restCenter = new THREE.Vector2(p.contactRadius * Math.cos(p.faceAngle) + radius * Math.sin(p.faceAngle),
    p.contactRadius * Math.sin(p.faceAngle) - radius * Math.cos(p.faceAngle));
  const length = restCenter.distanceTo(new THREE.Vector2(0, p.armRadius));
  const restAngle = Math.atan2(restCenter.x, p.armRadius - restCenter.y);
  const centerAt = (angle) => new THREE.Vector2(length * Math.sin(angle), p.armRadius - length * Math.cos(angle));
  const clearanceAt = (angle, relativeAngle) => {
    const c = centerAt(angle).rotateAround(new THREE.Vector2(), relativeAngle);
    let distanceSquared = Infinity, inside = false;
    for (let i = 0; i < outline.length; i += 1) {
      const a = outline[i], b = outline[(i + 1) % outline.length], dx = b.x - a.x, dy = b.y - a.y;
      const t = THREE.MathUtils.clamp(((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      distanceSquared = Math.min(distanceSquared, (c.x - a.x - t * dx) ** 2 + (c.y - a.y - t * dy) ** 2);
      if ((a.y > c.y) !== (b.y > c.y) && c.x < (b.x - a.x) * (c.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return (inside ? -1 : 1) * Math.sqrt(distanceSquared) - radius;
  };
  // A massless, spring-biased pawl rests against a physical heel stop. A
  // passing tooth lifts it away from that stop. The tooth outline, including
  // its crest corners, determines the lift; no sinusoidal lift is imposed.
  const angleAt = (relativeAngle) => {
    const phase = THREE.MathUtils.euclideanModulo(relativeAngle + pitch / 2, pitch) - pitch / 2;
    if (clearanceAt(restAngle, phase) >= -1e-12) return restAngle;
    let blocked = restAngle, clear = -1.25;
    for (let i = 1; i <= 64; i += 1) {
      const angle = restAngle + (-1.25 - restAngle) * i / 64;
      if (clearanceAt(angle, phase) >= 0) { clear = angle; break; }
      blocked = angle;
    }
    for (let i = 0; i < 36; i += 1) {
      const middle = (clear + blocked) / 2;
      if (clearanceAt(middle, phase) >= 0) clear = middle; else blocked = middle;
    }
    return clear;
  };
  return { parameters: p, pitch, outline, length, restAngle, restCenter, centerAt, clearanceAt, angleAt };
}

export function makeRatchetBevelMotion({ amplitude, frequency = 0.8 } = {}) {
  const follower = makeRatchetFollower(), pitch = follower.pitch;
  // Four teeth per half-stroke give Brown's continuous one-direction drive.
  // Other amplitudes are supported and retain their real lost motion.
  const inputAmplitude = amplitude ?? 2 * pitch;
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
