// Planar overlap depth between movement 080's rendered hook webs and rack.
// The webs and rack are straight extrusions sharing a z range, so their solids
// overlap exactly where these outlines do. Depth is the largest distance by
// which a vertex of one outline lies inside the other.
import {rotate} from '../../src/simulation/finite-plate-geometry.js';

const segmentDistance = (p, a, b) => {
 const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
 return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const rings = multi => multi.flatMap(polygon => polygon);
const segments = ringList => ringList.flatMap(ring => ring.slice(0, -1).map((a, i) => [a, ring[i + 1]]));
const inside = (p, segs) => {
 let c = false;
 for (const [a, b] of segs) if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) c = !c;
 return c;
};

export function makeCrossedRackOverlap(u) {
 const rackSegments = segments(rings(u.profiles.rack)), rackPoints = rackSegments.map(s => s[0]);
 const hooks = Object.fromEntries(['left', 'right'].map(key => {
  const ringList = rings(u.profiles[key]);
  return [key, {points: ringList.flatMap(r => r.slice(0, -1)), segments: segments(ringList)}];
 }));
 const box = pts => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
 const near = (b, s, pad) => Math.max(s[0][0], s[1][0]) >= b[0] - pad && Math.min(s[0][0], s[1][0]) <= b[2] + pad && Math.max(s[0][1], s[1][1]) >= b[1] - pad && Math.min(s[0][1], s[1][1]) <= b[3] + pad;
 // Depth of overlap for one pose; positive values are overlaps.
 return ({q, rackY, leftAngle, rightAngle}) => {
  let depth = 0;
  for (const [key, angle] of [['left', leftAngle], ['right', rightAngle]]) {
   const pivot = rotate(u.geometry.anchors[key], q), hook = hooks[key],
    // Hook outline in the rack's frame.
    place = v => {const r = rotate(v, angle); return [r[0] + pivot[0], r[1] + pivot[1] - rackY];},
    points = hook.points.map(place), segs = hook.segments.map(([a, b]) => [place(a), place(b)]), b = box(points),
    localRack = rackSegments.filter(s => near(b, s, .05)),
    // Rays run outward, away from the rack's centre line, so only this edge's segments count.
    sign = Math.sign(b[0] + b[2]),
    mirrored = rackSegments.filter(s => Math.max(sign * s[0][0], sign * s[1][0]) > 0 && Math.max(s[0][1], s[1][1]) >= b[1] && Math.min(s[0][1], s[1][1]) <= b[3])
     .map(([a, c]) => [[sign * a[0], a[1]], [sign * c[0], c[1]]]);
   if (localRack.length) for (const p of points) {
    if (inside([sign * p[0], p[1]], mirrored)) depth = Math.max(depth, Math.min(...localRack.map(([a, c]) => segmentDistance(p, a, c))));
   }
   for (const p of rackPoints) {
    if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue;
    if (inside(p, segs)) depth = Math.max(depth, Math.min(...segs.map(([a, c]) => segmentDistance(p, a, c))));
   }
  }
  return depth;
 };
}
