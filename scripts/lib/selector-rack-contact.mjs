import {surfaceTriangles} from '../../tests/helpers/solid-surface.mjs';

const bounds = points => ({low: [0, 1].map(i => Math.min(...points.map(p => p[i]))),
  high: [0, 1].map(i => Math.max(...points.map(p => p[i])))});
const cell = points => ({points, box: bounds(points), axes: points.map((a, i) => {
  const b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  if (!(length > 0)) throw Error('Degenerate footprint edge'); return [-dy / length, dx / length];
})});

// Exact translational SAT interval for two convex footprints. A moves in x.
// Closed interval endpoints are contact; its interior is forbidden overlap.
export function horizontalTriangleInterval(a, b, range = [-Infinity, Infinity]) {
  let enter = -Infinity, leave = Infinity, enterAxis = null, leaveAxis = null;
  for (const axis of [...a.axes, ...b.axes]) {
    const A = a.points.map(p => p[0] * axis[0] + p[1] * axis[1]);
    const B = b.points.map(p => p[0] * axis[0] + p[1] * axis[1]);
    const low = Math.min(...B) - Math.max(...A), high = Math.max(...B) - Math.min(...A), speed = axis[0];
    if (Math.abs(speed) < 1e-12) {if (low > 1e-12 || high < -1e-12) return null; continue;}
    const lo = Math.min(low / speed, high / speed), hi = Math.max(low / speed, high / speed);
    if (lo > enter) {enter = lo; enterAxis = axis;}
    if (hi < leave) {leave = hi; leaveAxis = axis;}
    if (enter > leave || enter > range[1] || leave < range[0]) return null;
  }
  return {enter, leave, enterAxis, leaveAxis};
}
export const triangleFootprint = cell;

export function makeSelectorRackContact(candidate) {
  const u = candidate.root.userData, range = u.geometry.limits.rackX;
  const caps = mesh => {
    const triangles = surfaceTriangles(mesh.geometry), top = Math.max(...triangles.flatMap(t => [t.a.z, t.b.z, t.c.z]));
    return triangles.filter(t => [t.a, t.b, t.c].every(p => Math.abs(p.z - top) < 1e-8))
      .map(t => cell([t.a, t.b, t.c].map(p => [p.x, p.y])));
  };
  const frame = caps(u.parts.slottedRackFrame), cam = caps(u.parts.singleWorkingCam);
  const radius = Math.max(...cam.flatMap(c => c.points.map(p => Math.hypot(...p))));
  let previousAngle, rotated;
  const intervalsAt = (angle, y) => {
    if (![angle, y].every(Number.isFinite)) throw Error('Nonfinite footprint pose');
    if (angle !== previousAngle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      rotated = cam.map(part => cell(part.points.map(([x, y]) => [c * x - s * y, s * x + c * y]))); previousAngle = angle;
    }
    const intervals = []; let checkedPairs = 0, excludedPairs = 0;
    for (const [frameCell, part] of frame.entries()) {
      if (part.box.low[1] + y > radius || part.box.high[1] + y < -radius ||
        part.box.low[0] + range[0] > radius || part.box.high[0] + range[1] < -radius) {excludedPairs += cam.length; continue;}
      const moving = {...part, points: part.points.map(p => [p[0], p[1] + y])};
      for (const [camCell, fixed] of rotated.entries()) {
        if (part.box.low[1] + y > fixed.box.high[1] || part.box.high[1] + y < fixed.box.low[1] ||
          part.box.low[0] + range[0] > fixed.box.high[0] || part.box.high[0] + range[1] < fixed.box.low[0]) {excludedPairs++; continue;}
        checkedPairs++;
        const interval = horizontalTriangleInterval(moving, fixed, range);
        if (interval && interval.leave - interval.enter > 1e-12) intervals.push({...interval, frameCell, camCell});
      }
    }
    const merged = [];
    for (const interval of intervals.sort((a, b) => a.enter - b.enter)) {
      const last = merged.at(-1);
      if (!last || interval.enter > last.leave + 1e-12) merged.push({enter: interval.enter, leave: interval.leave,
        enterWitness: interval, leaveWitness: interval});
      else if (interval.leave > last.leave) {last.leave = interval.leave; last.leaveWitness = interval;}
    }
    return {intervals: merged, checkedPairs, excludedPairs};
  };
  const allowedAt = (angle, y) => {
    const result = intervalsAt(angle, y), allowed = []; let left = range[0];
    for (const interval of result.intervals) {
      if (interval.enter >= left) allowed.push([left, Math.min(range[1], interval.enter)]);
      left = Math.max(left, interval.leave); if (left > range[1]) break;
    }
    if (left <= range[1]) allowed.push([left, range[1]]);
    return {...result, allowed};
  };
  return {frame, cam, radius, range, intervalsAt, allowedAt};
}
