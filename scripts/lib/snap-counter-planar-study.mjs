// Independent planar study utilities; not used by the production mechanism.
export const rotate = ([x, y], angle) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export function polygon(points) {
  const segments = points.map((a, i) => {
    const b = points[(i + 1) % points.length], d = subtract(b, a);
    return { a, b, d, lengthSquared: d[0] ** 2 + d[1] ** 2,
      minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minY: Math.min(a[1], b[1]), maxY: Math.max(a[1], b[1]) };
  }).filter(segment => segment.lengthSquared > 1e-12);
  return { points, segments, minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
    minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) };
}
export function contains(poly, [x, y]) {
  let inside = false;
  for (const { a, b, d } of poly.segments) if ((a[1] > y) !== (b[1] > y)
    && x < a[0] + (y - a[1]) * d[0] / d[1]) inside = !inside;
  return inside;
}
export function pointSegmentDistance(point, { a, d, lengthSquared }) {
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * d[0] + (point[1] - a[1]) * d[1]) / lengthSquared));
  return Math.hypot(point[0] - a[0] - t * d[0], point[1] - a[1] - t * d[1]);
}
export function pointGap(poly, point, radius = 0) {
  let distance = Infinity;
  for (const edge of poly.segments) distance = Math.min(distance, pointSegmentDistance(point, edge));
  return (contains(poly, point) ? -distance : distance) - radius;
}
export function polygonGap(a, b, cap = 0.1) {
  if (a.minX > b.maxX + cap || b.minX > a.maxX + cap || a.minY > b.maxY + cap || b.minY > a.maxY + cap) return cap;
  let distance = cap;
  for (const left of a.segments) for (const right of b.segments) {
    if (left.minX > right.maxX + distance || right.minX > left.maxX + distance
      || left.minY > right.maxY + distance || right.minY > left.maxY + distance) continue;
    const denominator = cross(left.d, right.d), offset = subtract(right.a, left.a);
    if (Math.abs(denominator) > 1e-12) {
      const u = cross(offset, right.d) / denominator, v = cross(offset, left.d) / denominator;
      if (u > 1e-10 && u < 1 - 1e-10 && v > 1e-10 && v < 1 - 1e-10) return -1;
    }
    distance = Math.min(distance, pointSegmentDistance(left.a, right), pointSegmentDistance(left.b, right),
      pointSegmentDistance(right.a, left), pointSegmentDistance(right.b, left));
  }
  if (contains(a, b.points[0]) || contains(b, a.points[0])) return -1;
  return distance;
}

// Remain in the preceding allowed component under a downward restoring load.
// Negative-to-positive gap crossings are stable supporting contacts. Escape
// may create a downward discontinuity; the study records rather than animates it.
export function settleCoordinate(gap, previous, lower = 0, upper = 1, step = 0.003) {
  const tolerance = 0.02;
  let high = Math.max(lower, previous), low;
  if (gap(high) < tolerance) {
    while (high < upper && gap(high) < tolerance) high += step;
    if (high >= upper) throw new Error(`No supporting contact below ${upper}`);
    low = Math.max(lower, high - step);
  } else {
    low = Math.max(lower, high - step);
    while (low > lower && gap(low) >= tolerance) { high = low; low = Math.max(lower, low - step); }
    if (low === lower && gap(low) >= tolerance) return lower;
  }
  for (let i = 0; i < 32; i += 1) {
    const middle = (low + high) / 2;
    if (gap(middle) >= tolerance) high = middle; else low = middle;
  }
  return high;
}
