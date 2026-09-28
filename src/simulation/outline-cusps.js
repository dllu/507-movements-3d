// Outlines cut by a swept cutter (a tooth or pin subtracted at many sampled
// poses) carry a fine sawtooth: each pose leaves its own hollow and the
// hollows meet in sharp outward cusps. Cutting off every sharp outward cusp
// between short segments replaces it with the chord of its neighbours. That
// only removes material, so every clearance the cut guaranteed still holds,
// and the surface shades as the smooth envelope it approximates.
//
// points: an open ring of [x, y] pairs or objects with x and y; returns a new
// open ring of the same kind. material: +1 when the material lies to the left
// of the ring's direction (a counter-clockwise outer ring), -1 when it lies to
// the right. maxSegment: both segments at a removable cusp are shorter than
// this. minTurn: the cusp turns outward by more than this (radians).
// tinySegment: also cut an outward corner when either of its segments is
// shorter than this (a step left where a band's square corner stands proud of
// a joint disc's chords); the chord departs from the corner by at most that
// segment. The default 0 leaves the rule off.
export function trimOutwardCusps(points, { material = 1, maxSegment = 0.01, minTurn = 20 * Math.PI / 180, minPoints = 8, tinySegment = 0 } = {}) {
  const ring = points.slice();
  const xy = (p) => (Array.isArray(p) ? p : [p.x, p.y]);
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < ring.length && ring.length > minPoints; i += 1) {
      const a = xy(ring[(i + ring.length - 1) % ring.length]), p = xy(ring[i]), b = xy(ring[(i + 1) % ring.length]);
      const u = [p[0] - a[0], p[1] - a[1]], v = [b[0] - p[0], b[1] - p[1]];
      const turn = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]) * material;
      const lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
      if (turn > minTurn && ((lu < maxSegment && lv < maxSegment) || Math.min(lu, lv) < tinySegment)) {
        ring.splice(i, 1);
        i -= 1;
        changed = true;
      }
    }
  }
  return ring;
}

// Signed area of an open ring (positive when counter-clockwise).
export function ringArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i], q = points[(i + 1) % points.length];
    const [ax, ay] = Array.isArray(p) ? p : [p.x, p.y], [bx, by] = Array.isArray(q) ? q : [q.x, q.y];
    area += ax * by - bx * ay;
  }
  return area / 2;
}
