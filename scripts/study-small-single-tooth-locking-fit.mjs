import { writeFile } from 'node:fs/promises';
import { makeSmallSingleToothSourceProfiles } from './lib/small-single-tooth-source.mjs';
import { makeSingleToothStarSolid } from './lib/single-tooth-star-solid.mjs';

const profile = makeSmallSingleToothSourceProfiles(), p = profile.parameters;
// Validate angular ordering before using either as a radial solid.
makeSingleToothStarSolid(profile.driver[0]); makeSingleToothStarSolid(profile.output[0]);
const edges = profile.output[0].map((a, i, ring) => {
  const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1];
  return { a, dx, dy, lengthSquared: dx * dx + dy * dy };
});
const gap = (distance, q) => {
  const x = distance * Math.cos(q), y = -distance * Math.sin(q); let closest = Infinity;
  for (const edge of edges) {
    const dx = x - edge.a[0], dy = y - edge.a[1];
    const t = Math.max(0, Math.min(1, (dx * edge.dx + dy * edge.dy) / edge.lengthSquared));
    closest = Math.min(closest, Math.hypot(dx - t * edge.dx, dy - t * edge.dy));
  }
  return closest - p.driverRadius;
};
const maximumGap = distance => {
  const count = 64; let best = { q: 0, gap: -Infinity };
  for (let i = 0; i < count; i++) {
    const q = -p.pitch * i / count, value = gap(distance, q);
    if (value > best.gap) best = { q, gap: value };
  }
  let low = best.q - p.pitch / count, high = best.q + p.pitch / count;
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 65; i++) {
    const a = high - ratio * (high - low), b = low + ratio * (high - low);
    if (gap(distance, a) > gap(distance, b)) high = b; else low = a;
  }
  const q = (low + high) / 2; return { q, gap: gap(distance, q) };
};
let low = 3, high = 3.5;
for (let i = 0; i < 45; i++) {
  const mid = (low + high) / 2;
  if (maximumGap(mid).gap < 0.00015) low = mid; else high = mid;
}
const centerDistance = (low + high) / 2, best = maximumGap(centerDistance);
const seat = sign => {
  let low = 0, high = p.pitch / 2;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (gap(centerDistance, best.q + sign * mid) >= 0) low = mid; else high = mid;
  }
  return best.q + sign * (low + high) / 2;
};
const negativeSeat = seat(-1), positiveSeat = seat(1);
const result = { movement: 69, status: 'source-profile-locking-fit', productionChanged: false,
  method: 'Exact point-to-segment distance from the circular driver center to the measured thirty-tooth output polygon. Optimize phase, then center spacing for 0.00015 maximum rim clearance. This fits stationary locking geometry only; the shaped tooth and driven motion remain unverified.',
  parameters: { ...p, centerDistance, initialQ: positiveSeat, negativeSeat, positiveSeat,
    fullAngularPlay: positiveSeat - negativeSeat, clearance: 0.00015 },
  best, sourceDistanceDifference: p.sourceCenterDistance - centerDistance,
  sourceDistanceDifferencePixels: (p.sourceCenterDistance - centerDistance) * p.sourceScale,
  driverVertices: profile.driver[0].length, outputVertices: profile.output[0].length,
};
await writeFile('artifacts/review/069-source-profile-locking-fit.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(result);
