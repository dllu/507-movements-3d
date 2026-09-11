import { readFile, writeFile } from 'node:fs/promises';
import { sourceLayout as p, traces, sourceShape } from '../artifacts/review/063-provisional-source-layout.mjs';
import { rotate, add, subtract, polygon, pointGap, polygonGap, settleCoordinate } from './lib/snap-counter-planar-study.mjs';

const fit = JSON.parse(await readFile('artifacts/review/063-source-tracing.json', 'utf8'));
const sourcePoint = ([x, y]) => [x - p.pivot[0], p.pivot[1] - y];
const dropTailExtension = Number(process.env.DROP_TAIL_EXTENSION ?? 0);
const pawlCamExtension = Number(process.env.PAWL_CAM_EXTENSION ?? 0);
const bodies = Object.fromEntries(Object.entries(traces).map(([name, commands]) => [name,
  polygon(sourceShape(commands.map(row => {
    if (name === 'drop' && row[0] === 'L' && row[1] === 890 && row[2] === 795) return ['L', row[1], row[2] + dropTailExtension];
    if (name === 'pawl' && row[0] === 'Q' && row[1] === 788) return ['Q', row[1], row[2] + pawlCamExtension, row[3], row[4] + pawlCamExtension];
    if (name === 'pawl' && row[0] === 'Q' && row[1] === 948) return ['Q', row[1], row[2] + pawlCamExtension / 2, row[3], row[4]];
    return row;
  })).getPoints(16).map(point => sourcePoint(point.toArray())))]));
const toeOnly = process.env.PAWL_TOE_ONLY === '1';
const toeShift = [Number(process.env.TOE_X_SHIFT ?? 0), Number(process.env.TOE_Y_SHIFT ?? 0)];
const toe = polygon([[704, 714], [707, 672], [744, 699]].map(point => sourcePoint(add(point, toeShift))));
const driverCenter = sourcePoint(p.driverCenter), starCenter = sourcePoint(p.starCenter);
driverCenter[0] += Number(process.env.DRIVER_X_SHIFT ?? 0);
driverCenter[1] += Number(process.env.DRIVER_Y_SHIFT ?? 0);
starCenter[0] += Number(process.env.STAR_X_SHIFT ?? 0);
starCenter[1] += Number(process.env.STAR_Y_SHIFT ?? 0);
const leafStart = sourcePoint([50, 470]), leafEnd = sourcePoint([330, 455]);
const leafVector = subtract(leafEnd, leafStart), leafLength = Math.hypot(...leafVector), leafAngle = Math.atan2(leafVector[1], leafVector[0]);
const strikerPoint = sourcePoint([p.striker[0], p.striker[1] + Number(process.env.STRIKER_Y_SHIFT ?? 0)]);
let strikerLow = -0.2, strikerHigh = 0.2;
for (let i = 0; i < 40; i += 1) {
  const middle = (strikerLow + strikerHigh) / 2;
  if (pointGap(bodies.pawl, rotate(strikerPoint, middle), p.strikerRadius) >= 0.02) strikerHigh = middle;
  else strikerLow = middle;
}
const strikerOffset = strikerHigh;
const starPhase = Number(process.env.STAR_PHASE ?? 24) * Math.PI / 180;
const starGapOffset = Number(process.env.STAR_GAP_OFFSET ?? 0) * Math.PI / 180;
const support = process.env.PROBE_SUPPORT ?? 'rotating-leaf';
const driverDirection = Number(process.env.PROBE_DIRECTION ?? -1);
const pinOrbitRadius = fit.pinOrbitRadius * Number(process.env.PIN_ORBIT_SCALE ?? 1);
const dropMinimum = Number(process.env.DROP_MINIMUM ?? 0);
const springPivot = sourcePoint([Number(process.env.SPRING_PIVOT_X ?? 200), Number(process.env.SPRING_PIVOT_Y ?? 465)]);
const dropAngle = q => support === 'vertical' ? 0 : q;
const starRadius = Number(process.env.STAR_RADIUS ?? p.starRadius), starGapRadius = Number(process.env.STAR_GAP_RADIUS ?? p.starGapRadius);
const starLocal = Array.from({ length: 20 }, (_, i) => {
  const angle = starPhase + i * Math.PI / 10 + (i % 2 ? starGapOffset : 0), radius = i % 2 ? starGapRadius : starRadius;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
});
const starAt = gamma => polygon(starLocal.map(point => add(starCenter, rotate(point, gamma))));
const hingeCache = new Map();
const hingeAt = q => {
  if (support === 'vertical') return [0, 200 * q];
  if (support === 'spring-pivot') return add(springPivot, rotate([-springPivot[0], -springPivot[1]], q));
  if (!hingeCache.has(q)) {
    let x = 0, y = 0;
    const count = 48;
    for (let i = 0; i < count; i += 1) {
      const s = (i + 0.5) / count, angle = leafAngle + q * (2 * s - s * s);
      x += leafLength / count * Math.cos(angle); y += leafLength / count * Math.sin(angle);
    }
    hingeCache.set(q, add(add(leafStart, [x, y]), rotate([-leafEnd[0], -leafEnd[1]], q)));
  }
  return hingeCache.get(q);
};
const pinsAt = phase => Array.from({ length: 3 }, (_, index) => {
  const angle = fit.pinMountPhase + (-index + driverDirection * phase) * 2 * Math.PI / 3;
  return add(driverCenter, [pinOrbitRadius * Math.cos(angle), pinOrbitRadius * Math.sin(angle)]);
});
const pinGap = (body, pins, q, angle) => {
  const hinge = hingeAt(q);
  return Math.min(...pins.map(pin => pointGap(bodies[body], rotate(subtract(pin, hinge), -angle), p.pinRadius)));
};
const pawlStarGap = (q, beta, star) => {
  const hinge = hingeAt(q);
  return polygonGap(toeOnly ? toe : bodies.pawl, polygon(star.points.map(point => rotate(subtract(point, hinge), -beta))));
};
const pawlRest = (pins, q, previous, star = null) => settleCoordinate(beta => Math.min(pinGap('pawl', pins, q, beta),
  star ? pawlStarGap(q, beta, star) : 1), previous, -1.2, 1.2);
const moveStar = (q, beta, gamma) => {
  const gap = delta => pawlStarGap(q, beta, starAt(gamma + delta));
  if (gap(0) >= 0.02) return gamma;
  const candidates = [];
  for (const sign of [-1, 1]) {
    let high = 0.001;
    while (high < Math.PI / 5 && gap(sign * high) < 0.02) high += 0.001;
    if (high >= Math.PI / 5) continue;
    let low = high - 0.001;
    for (let i = 0; i < 30; i += 1) {
      const middle = (low + high) / 2;
      if (gap(sign * middle) >= 0.02) high = middle; else low = middle;
    }
    candidates.push(sign * high);
  }
  candidates.sort((a, b) => Math.abs(a) - Math.abs(b));
  if (!candidates.length) throw new Error('No star rotation resolves the imposed pawl stroke.');
  return gamma + candidates[0];
};

const count = Number(process.env.PROBE_STEPS ?? 720), cycles = Number(process.env.PROBE_CYCLES ?? 3);
const rows = [], issues = [];
let q = dropMinimum, beta = 0.05, gamma = 0;
for (let index = 0; index <= count * cycles; index += 1) {
  const phase = index / count, pins = pinsAt(phase), previous = { q, beta, gamma };
  try {
    const targetQ = settleCoordinate(candidate => {
      const drop = pinGap('drop', pins, candidate, dropAngle(candidate));
      if (drop < 0.02) return drop;
      const allowedBeta = dropAngle(candidate) - strikerOffset;
      const pinPawl = settleCoordinate(angle => pinGap('pawl', pins, candidate, angle),
        beta, allowedBeta, 1.2);
      return pinPawl <= allowedBeta + 1e-8 ? drop : Math.min(drop, -200 * (pinPawl - allowedBeta));
    }, q, dropMinimum, support === 'vertical' ? 2 : 0.9);
    const steps = targetQ < q ? Math.max(1, Math.ceil((q - targetQ) / 0.002)) : 1, startQ = q;
    for (let step = 1; step <= steps; step += 1) {
      q = startQ + (targetQ - startQ) * step / steps;
      const allowedBeta = dropAngle(q) - strikerOffset;
      const desiredBeta = pawlRest(pins, q, beta, starAt(gamma));
      if (desiredBeta > allowedBeta + 1e-7) {
        if (pinGap('pawl', pins, q, allowedBeta) < 0) throw new Error('The striker-bound pawl intersects a driver pin.');
        beta = allowedBeta; gamma = moveStar(q, beta, gamma);
      } else beta = desiredBeta;
    }
    const row = { phase, q, beta, gamma, hinge: hingeAt(q),
      dropPinGap: pinGap('drop', pins, q, dropAngle(q)), pawlPinGap: pinGap('pawl', pins, q, beta),
      pawlStarGap: pawlStarGap(q, beta, starAt(gamma)),
      strikerPawlGap: pointGap(bodies.pawl, rotate(strikerPoint, dropAngle(q) - beta), p.strikerRadius) };
    rows.push(row);
    if (index % 120 === 0) console.log(JSON.stringify({ phase, q, beta, gamma }));
    if ([row.dropPinGap, row.pawlPinGap, row.pawlStarGap, row.strikerPawlGap].some(gap => gap < -1e-7)) issues.push(row);
  } catch (error) { issues.push({ phase, previous, q, beta, gamma, error: error.message }); break; }
}
const report = { status: 'provisional-moving-hinge-flexure-study',
  method: 'The drop and its upper pawl hinge follow a constant-length leaf with prescribed tip-angle curvature, an ideal spring pivot, or a vertical guide. All three finite pins lift traced plate polygons. The pawl settles under gravity against pins or the star. A finite striker bounds its relative angle. If the spring-driven striker would penetrate a star tooth, the nearest output rotation restores sampled clearance. This simplified solver omits star motion caused by other hinge/contact forces and does not enforce a two-flank seated nose constraint. This is a quasi-static planar hypothesis study; finite release dynamics, force signs, 3D construction and tooth-index repeatability remain to be verified.',
  parameters: { support, driverDirection, dropMinimum, dropTailExtension, pawlCamExtension, pinOrbitRadius, toeOnly, toeShift, driverCenter, starCenter, springPivot, leafStart, leafEnd, leafLength, leafAngle, starPhase, starGapOffset, starRadius, starGapRadius, strikerOffset, strikerPoint },
  rows: rows.length, requestedPoses: count * cycles + 1, issues,
  outputTurns: gamma / (2 * Math.PI), outputToothSteps: gamma / (Math.PI / 5),
  eventStates: rows.filter(row => Math.abs(row.phase - Math.round(row.phase)) < 1e-8), samples: rows };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/063-flexure-study.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, samples: undefined, issues: issues.slice(0, 5) }, null, 2));
