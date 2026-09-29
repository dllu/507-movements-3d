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
  // p101: C's notch is one clean V: two straight flanks joined by a root arc,
  // the convex hull of the rounded toe's disc (radius toeRadius plus a small
  // relief) along its path while the passing stud thrusts the stop's tooth
  // out. Brown's text: the stud thrusts the lever's end out and the other
  // extremity enters the notch; on the tappet leaving the stud the lever is
  // forced up again (by the notch's trailing flank) and held by C's rim. So
  // the stop follows the stud until its deepest point, then rests until the
  // trailing flank lifts its toe back onto the rim.
  if (!(p.toeRadius > 0)) return { p, pin, motion, toothContact, stopAt };
  const toeAt = (gamma, theta) => rotate(add(p.pivot, rotate(p.toeCenter, theta)), -gamma);
  const relief = p.notchRelief ?? .004, samples = 1024, discSteps = 192, cloud = [];
  let kneeGamma = p.gammaStart, kneeTheta = 0;
  for (let i = 0; i <= samples; i++) {
    const gamma = p.gammaStart + (p.gammaEnd - p.gammaStart) * i / samples, theta = stopAt(motion(gamma).beta).theta;
    if (theta < kneeTheta) { kneeTheta = theta; kneeGamma = gamma; }
    const c = toeAt(gamma, theta);
    for (let k = 0; k < discSteps; k++) cloud.push(add(c, polar((p.toeRadius + relief) / Math.cos(Math.PI / discSteps), TAU * (k + .5) / discSteps)));
  }
  {
    // Refine the knee: the stud's deepest thrust.
    const step = (p.gammaStart - p.gammaEnd) / samples, f = g => stopAt(motion(g).beta).theta;
    let lo = kneeGamma - step, hi = kneeGamma + step;
    for (let i = 0; i < 80; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (f(a) < f(b)) hi = b; else lo = a; }
    kneeGamma = (lo + hi) / 2; kneeTheta = Math.min(kneeTheta, f(kneeGamma));
  }
  for (const gamma of [p.gammaStart, p.gammaEnd]) cloud.push(scale(unit(toeAt(gamma, 0)), p.driverRadius + .35));
  const hull = convexHull(cloud);
  // C's outline: the rim circle less the hull.
  const rimSteps = 4096, inside = q => hull.every((a, i) => cross(sub(hull[(i + 1) % hull.length], a), sub(q, a)) > 0);
  const cam = [];
  for (let i = 0; i < rimSteps; i++) { const q = polar(p.driverRadius, TAU * i / rimSteps); if (!inside(q)) cam.push(q); }
  const crossings = [];
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], d = sub(b, a), A = dot(d, d), B = 2 * dot(a, d), C = dot(a, a) - p.driverRadius ** 2;
    const disc = B * B - 4 * A * C; if (disc < 0) continue;
    for (const t of [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)]) if (t >= 0 && t <= 1) crossings.push(add(a, scale(d, t)));
  }
  const chain = [...crossings, ...hull.filter(q => norm(q) < p.driverRadius)];
  cam.push(...chain);
  cam.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  p.notchHull = hull; p.cam = cam; p.kneeGamma = kneeGamma; p.kneeTheta = kneeTheta; p.notchRelief = relief;
  // The toe can meet only the notch's flanks and root (the hull chain inside
  // the rim) and the true rim circle beside it.
  chain.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  const local = chain.slice(1).map((b, i) => [chain[i], b]);
  const toeClearance = (gamma, theta) => {
    const c = toeAt(gamma, theta), r = norm(c);
    const inMaterial = r < p.driverRadius && !inside(c);
    let d = Infinity; for (const [a, b] of local) d = Math.min(d, closestSegment(c, a, b).distance);
    if (!inside(scale(c, p.driverRadius / r))) d = Math.min(d, Math.abs(r - p.driverRadius));
    return inMaterial ? -d - p.toeRadius : d - p.toeRadius;
  };
  const stopAtGamma = gamma => {
    const beta = motion(gamma).beta;
    if (gamma >= p.gammaStart || gamma <= p.gammaEnd - .3) return { theta: 0, drive: 'rim', ...toothContact(beta, 0) };
    if (gamma >= kneeGamma) { const theta = stopAt(beta).theta; return { theta, drive: 'stud', ...toothContact(beta, theta) }; }
    // After the knee the stop rests until C's trailing flank, and then the
    // flank's corner, lift the toe back onto the rim (a little after the
    // index ends); the lowest clear angle, at most the rim's 0.
    if (toeClearance(gamma, kneeTheta) >= 0) return { theta: kneeTheta, drive: 'rest', ...toothContact(beta, kneeTheta) };
    if (toeClearance(gamma, 0) < -1e-9) throw Error('C leaves no room for the stop toe');
    let lo = kneeTheta, hi = 0;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (toeClearance(gamma, mid) >= 0) hi = mid; else lo = mid; }
    if (hi > -1e-12) hi = 0;
    return { theta: hi, drive: hi === 0 ? 'rim' : 'flank', ...toothContact(beta, hi) };
  };
  return { p, pin, motion, toothContact, stopAt, stopAtGamma, toeClearance, toeAt };
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => { const out = []; for (const q of list) { while (out.length >= 2 && turn(out.at(-2), out.at(-1), q) <= 0) out.pop(); out.push(q); } out.pop(); return out; };
  return [...half(sorted), ...half([...sorted].reverse())];
}
