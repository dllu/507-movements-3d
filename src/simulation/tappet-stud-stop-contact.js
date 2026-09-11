// Contact geometry for Brown movement 065: a finite tappet and a two-sided stop.
export const TAU = Math.PI * 2;
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const scale = (a, t) => [a[0] * t, a[1] * t];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const norm = a => Math.hypot(...a);
export const unit = a => scale(a, 1 / norm(a));
export const rotate = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
export const polar = (r, t) => [r * Math.cos(t), r * Math.sin(t)];
export function closestSegment(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  const point = add(a, scale(ab, t));
  return { point, distance: norm(sub(p, point)), t };
}
export function makeTappetStudStopContact(options = {}) {
  const p = { D: 664 / 260, R: 1.085, pinRadius: .095, betaStart: Math.PI - .04,
    pitch: TAU / 10, h: .25, tipRadius: .065, pivot: [334 / 260, -322 / 260],
    leftSlope: .8, rightSlope: -.65, toeRadius: .07, driverRadius: 1.25,
    leftExtension: .2, rightExtension: .13,
    toeAngle: -78 * Math.PI / 180, ...options };
  const pin = beta => add([p.D, 0], polar(p.R, beta));
  const end = pin(p.betaStart + p.pitch), start = pin(p.betaStart);
  const tipCenterRadius = norm(end) - p.pinRadius - p.tipRadius;
  p.tipCenter = [Math.sqrt(tipCenterRadius ** 2 - (p.tipRadius - p.h) ** 2), p.tipRadius - p.h];
  p.gammaStart = Math.atan2(start[1], start[0]) + Math.asin((p.h + p.pinRadius) / norm(start));
  p.gammaEnd = Math.atan2(end[1], end[0]) - Math.atan2(p.tipCenter[1], p.tipCenter[0]);
  const flatBeta = gamma => gamma + Math.PI - Math.asin((p.D * Math.sin(gamma) - p.h - p.pinRadius) / p.R);
  let low = p.gammaEnd, high = p.gammaStart;
  for (let i = 0; i < 60; i++) {
    const gamma = (low + high) / 2, q = rotate(pin(flatBeta(gamma)), -gamma);
    if (q[0] > p.tipCenter[0]) low = gamma; else high = gamma;
  }
  p.gammaTipStart = (low + high) / 2;
  const motion = gamma => {
    if (gamma >= p.gammaStart) return { beta: p.betaStart, stage: 'locked-before' };
    if (gamma <= p.gammaEnd) return { beta: p.betaStart + p.pitch, stage: 'locked-after' };
    if (gamma >= p.gammaTipStart) {
      const beta = flatBeta(gamma), q = rotate(pin(beta), -gamma);
      return { beta, stage: 'flat', tappetPoint: rotate([q[0], -p.h], gamma), normal: rotate([0, -1], gamma) };
    }
    const cap = rotate(p.tipCenter, gamma), dc = sub(cap, [p.D, 0]), d = norm(dc);
    const cosine = (p.R ** 2 + d ** 2 - (p.pinRadius + p.tipRadius) ** 2) / (2 * p.R * d);
    const angle = Math.atan2(dc[1], dc[0]);
    let beta = angle + Math.acos(Math.max(-1, Math.min(1, cosine)));
    while (beta < Math.PI / 2) beta += TAU;
    const normal = unit(sub(pin(beta), cap));
    return { beta, stage: 'tip', tappetPoint: add(cap, scale(normal, p.tipRadius)), normal };
  };
  const leftPin = sub(pin(p.betaStart + 2 * p.pitch), p.pivot);
  const rightPin = sub(pin(p.betaStart + 3 * p.pitch), p.pivot);
  const lineIntercept = (s, q) => q[1] - s * q[0] - p.pinRadius * Math.sqrt(1 + s * s);
  const leftB = lineIntercept(p.leftSlope, leftPin), rightB = lineIntercept(p.rightSlope, rightPin);
  const x = (rightB - leftB) / (p.leftSlope - p.rightSlope);
  p.tooth = [[leftPin[0] - p.leftExtension, p.leftSlope * (leftPin[0] - p.leftExtension) + leftB],
    [x, p.leftSlope * x + leftB],
    [rightPin[0] + p.rightExtension, p.rightSlope * (rightPin[0] + p.rightExtension) + rightB]];
  p.toeCenter = sub(polar(p.driverRadius + p.toeRadius, p.toeAngle), p.pivot);
  const toothContact = (beta, theta) => {
    const candidates = [];
    for (let i = 0; i < 10; i++) {
      const center = rotate(sub(pin(beta + i * p.pitch), p.pivot), -theta);
      for (let j = 0; j < 2; j++) {
        const hit = closestSegment(center, p.tooth[j], p.tooth[j + 1]);
        candidates.push({ stud: i, edge: j, center, ...hit, gap: hit.distance - p.pinRadius,
          normal: unit(sub(center, hit.point)) });
      }
    }
    return candidates.sort((a, b) => a.gap - b.gap)[0];
  };
  // Follow the upper, continuously connected nonpenetrating branch. The full
  // body, bore, face orientation and finite cam are checked by later studies.
  const stopAt = beta => {
    const nominal = toothContact(beta, 0);
    // A stud may cross an entire flank, so positive unsigned gap alone is
    // insufficient. Follow the known passing stud's upper-side envelope.
    const passingCenter = theta => rotate(sub(pin(beta + 2 * p.pitch), p.pivot), -theta);
    const gap = theta => {
      const c = passingCenter(theta);
      const hits = p.tooth.slice(0, 2).map((a, j) => closestSegment(c, a, p.tooth[j + 1]));
      const distance = Math.min(...hits.map(hit => hit.distance));
      const roof = c[0] < p.tooth[1][0] ? p.leftSlope * c[0] + leftB : p.rightSlope * c[0] + rightB;
      const below = c[0] >= p.tooth[0][0] && c[0] <= p.tooth[2][0] && c[1] < roof;
      return (below ? -distance : distance) - p.pinRadius;
    };
    let lo = -.6, hi = 0;
    if (gap(lo) < 0) throw Error('No released stop branch');
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (gap(mid) >= 0) lo = mid; else hi = mid; }
    const theta = (lo + hi) / 2;
    return { theta, ...toothContact(beta, theta), nominalGap: nominal.gap };
  };
  return { p, pin, motion, toothContact, stopAt };
}
