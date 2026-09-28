// Plate-measured parts and transfer sequence for 183/184 (two-quadrant hand
// gear). Coordinates are engraving pixels of plate 183 (y down, angles
// clockwise on the page); 184 is presented as the same gear reflected top to
// bottom (see authored-quadrant-catches.js).
//
// Every part is one of Brown's drawn outlines, extruded flat, and each lies in
// the plane his hidden lines put it in (back to front, `planes` below):
//   W  the lower back-weight arm, dashed behind the piston rod and the crook;
//   R  the piston rod, carrying the hatched tappet forward through A..H;
//   B  the upper back-weight arm, dashed behind the wing, eye showing at its tip;
//   A  the upper casting's C-arm and hooked tip, dashed behind the lower quadrant;
//   F  the latch plane: the lower quadrant band and web, and the upper wing;
//   H  the lower ball lever, drawn over the web's edge and the piston rod.
// No studs, lips, bosses or webs are added. The two quadrants latch each
// other only through their drawn, concentric rims in plane F:
// - Held upper (plate 183): the wing's toe rests on the lower band's rim,
//   concentric with the lower shaft, so the upper back weight cannot turn it
//   and the band slides freely under it.
// - Transfer: the tappet lifts the ball lever; when it runs off the lever's
//   end the blow throws the lower handle on (the caption's "throws the catches
//   and handles") until the band's left end passes the toe. The upper weight
//   drops the wing behind that end onto the upper valve stop, and the lower
//   handle falls back against the wing: it is held up.
// - Return: coming down, the tappet strikes the hooked C-arm, turns the upper
//   handle back and throws it clear; the lower handle falls onto the tappet,
//   rides it down, and the band slides back under the wing's toe.
// The rods, weights, valve stops and throw heights are inferred (undrawn).
// Departure: the lower quadrant is turned 14 deg clockwise on its hub relative
// to Brown's ball lever (see lowerCastingTurn), so the held lever clears the
// upper boss.
import polygonClipping from 'polygon-clipping';

export const deg = Math.PI / 180;
export const PU = Object.freeze([275, 128]);
export const PL = Object.freeze([283, 353]);
export const sourceScale = 0.0125;
export const tappetSource = Object.freeze({ x0: 170, x1: 188, h: 41 });
export const strokeSource = Object.freeze({ top: 86, bottom: 345, source183: 330 });
export const upperFreeStop = 10;
export const rimRadius = 137.5;
export const bandRadius = 134.5;
export const hubRadius = Object.freeze({ upper: 34, lower: 35 });
export const boreRadius = 16;
export const shaftRadius = 15;
export const eyes = Object.freeze({ upper: Object.freeze([400, 43]), lower: Object.freeze([142, 421]) });
export const eyeRadius = 10.5;
export const knob = Object.freeze({ center: Object.freeze([75, 307]), radius: 11.5 });
// Axial extents of the planes (model units) and the tappet, back to front.
export const planes = Object.freeze({
  rodsW: Object.freeze([-0.54, -0.485]),
  W: Object.freeze([-0.47, -0.39]),
  R: Object.freeze([-0.375, -0.255]),
  rodsB: Object.freeze([-0.30, -0.255]),
  B: Object.freeze([-0.24, -0.16]),
  A: Object.freeze([-0.145, -0.065]),
  F: Object.freeze([-0.05, 0.05]),
  H: Object.freeze([0.065, 0.145]),
});
export const TAPPET_PLANES = 'AFH';

const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const P = (pts) => [[[...pts, pts[0]]]];
export const circlePoints = (c, r, n = 48) => Array.from({ length: n }, (_, i) => [
  c[0] + r * Math.cos(2 * Math.PI * i / n), c[1] + r * Math.sin(2 * Math.PI * i / n)]);
export const circlePoly = (c, r, n = 96) => P(circlePoints(c, r, n));
const union = (...a) => polygonClipping.union(...a);
const diff = (a, ...b) => polygonClipping.difference(a, ...b);

// Catmull-Rom resampling of a drawn edge.
function smooth(pts, sub = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t
        + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts.at(-1));
  return out;
}
// Convex hull (monotone chain), for tangent-lever outlines.
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length > 1 && cross(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
// A plain lever: the tangent hull of a boss and an eye.
export const tangentLever = (a, ra, b, rb) => P(hull([...circlePoints(a, ra, 96), ...circlePoints(b, rb, 64)]));

// Brown's quadrant castings, rebuilt from their intended construction rather
// than traced pixel by pixel (the old traces wobbled and creased up to 23 deg).
// Rims and window edges that Brown draws concentric with a shaft are true
// arcs about it; every other drawn edge is a straight line or one circular arc
// through three points read off plate 183; the curly C-arm is two smooth
// splines through its drawn edges, ending in a round hook concentric with a
// single centre. Angles are page degrees (y down) about the named pivot.
const polar = (c, r, a) => [c[0] + r * Math.cos(a * deg), c[1] + r * Math.sin(a * deg)];
const arcAbout = (c, r, a0, a1, n = 96) => Array.from({ length: n + 1 }, (_, i) => polar(c, r, a0 + (a1 - a0) * i / n));
// The circular arc from p0 through pm to p1.
function arc3(p0, pm, p1, n = 64) {
  const [ax, ay] = p0, [bx, by] = pm, [cx, cy] = p1;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const ang = ([x, y]) => Math.atan2(y - uy, x - ux);
  const a0 = ang(p0), am = ang(pm);
  let a1 = ang(p1);
  const within = (a, s, e) => { const u = ((a - s) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), v = ((e - s) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return u <= v; };
  // Go the way that passes pm.
  let sweep = ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  if (!within(am, a0, a1)) sweep -= 2 * Math.PI;
  const r = Math.hypot(ax - ux, ay - uy);
  return Array.from({ length: n + 1 }, (_, i) => [ux + r * Math.cos(a0 + sweep * i / n), uy + r * Math.sin(a0 + sweep * i / n)]);
}
const chain = (...pieces) => { const out = []; for (const p of pieces) for (const q of p) { const l = out.at(-1); if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) out.push(q); } return out; };
// The point where the line from a through b meets the circle (c, r) beyond b.
function lineToCircle(a, b, c, r) {
  const d = [b[0] - a[0], b[1] - a[1]], f = [a[0] - c[0], a[1] - c[1]];
  const A = d[0] ** 2 + d[1] ** 2, B = 2 * (f[0] * d[0] + f[1] * d[1]), C = f[0] ** 2 + f[1] ** 2 - r * r;
  const t = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  return [a[0] + d[0] * t, a[1] + d[1] * t];
}
const angleAbout = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]) / deg;

// Lower quadrant (plane F): a band between the rim (bandRadius) and an inner
// rim at 111 px, both about the lower shaft, with straight end cuts; below
// each end a short lip, then a concave web flank (one arc) into the hub. The
// anvil window is the band's inner rim over two concave arc sides and a
// straight foot.
const bandInner = 111;
function lowerQuadrantOutline() {
  const leftOuter = lineToCircle([202.6, 276.4], [194.1, 251.9], PL, bandRadius + 3);
  const rightOuter = lineToCircle([358.9, 273.9], [366.1, 251.5], PL, bandRadius + 3);
  const outer = chain(
    [leftOuter, [202.9, 277.6], [212.5, 276.8]],
    arc3([212.5, 276.8], [240.5, 298.5], [252.4, 334]),
    [[282, 336]],
    arc3([310.5, 331], [323.9, 290.5], [344.5, 274.7]),
    [[358.9, 273.9], rightOuter],
    arcAbout(PL, bandRadius + 3, angleAbout(PL, rightOuter), angleAbout(PL, leftOuter), 256).slice(1, -1));
  const tl = polar(PL, bandInner, -116.5), tr = polar(PL, bandInner, -68.2);
  const window = chain(
    arcAbout(PL, bandInner, -116.5, -68.2, 96),
    arc3(tr, [302.9, 275.5], [290.4, 305.6]),
    arc3([271.6, 305.6], [256.1, 274.5], tl).slice(0, -1));
  return polygonClipping.difference(P(outer), P(window));
}

// Upper wing (plane F): the rim (rimRadius) about the upper shaft; a squared
// tab at the top; a straight upper edge running into the boss; a convex lower
// edge (one arc) down to the toe, which is cut to the band's rim. The pointed
// window is bounded by an arc concentric with the shaft (112 px) and two
// concave arcs meeting a short flank beside the boss.
function upperWingOutline() {
  const top = polar(PU, rimRadius + 3, -40.6);
  const outer = chain(
    [top, [355, 41.6], [350.2, 49.5], [350.3, 60.6]],
    [[274, 103.4]],
    [[287, 155]],
    arc3([291, 159.6], [320.1, 183], [334.4, 213.5]),
    [[333.3, 250]],
    arcAbout(PU, rimRadius + 3, 62, -40.6, 192).slice(0, -1));
  const tr = polar(PU, 112, -19.4), br = polar(PU, 112, 40.2);
  const window = chain(
    arcAbout(PU, 112, -19.4, 40.2, 96),
    arc3(br, [348.6, 175.7], [320.8, 149.8]),
    arc3([320.8, 149.8], [319.2, 136.5], [322.5, 124.1]).slice(1),
    arc3([322.5, 124.1], [350.3, 111.7], tr).slice(1, -1));
  return polygonClipping.difference(P(outer), P(window));
}

// Upper C-arm (plane A): two smooth splines through Brown's edges, ending in
// the hook's round end, concentric with one centre.
function upperArmOutline() {
  const hook = [207.6, 298.8], hookR = 7.4;
  const left = [[248, 118], [240.5, 129], [234, 139.5], [222.5, 157], [216.4, 177], [218, 196], [225.5, 212.5], [230, 230], [229, 248],
    [222.5, 268], [215.5, 285], polar(hook, hookR, -102)];
  const right = [polar(hook, hookR, 85), [216.5, 304.2], [225.5, 296.5], [233.5, 285.5], [240.8, 274.5],
    [245.6, 255], [247.6, 236.5], [246.5, 221], [240.2, 206], [235.8, 191], [236.8, 178], [242.5, 168], [250.5, 162], [260, 160], [270, 162.5], [280, 160]];
  const outline = chain(smooth(left, 10), arcAbout(hook, hookR, 258, 85, 48).slice(1, -1), smooth(right, 10));
  return P(outline);
}

// Brown's ball lever: a straight bar from the ball to a broad crook that
// wraps under the web into the hub (plate 183 edges, px).
const leverUpper = [[75, 300.5], [150, 300.5], [176, 301], [190, 305], [202, 317], [214, 330], [229, 335], [252, 337]];
const leverLower = [[75, 313.5], [150, 313.5], [174, 314], [186, 321], [196, 334], [205, 350], [215, 363], [230, 371], [256, 374]];
const leverOutline = () => union(P([...smooth(leverUpper), ...smooth(leverLower).reverse()]), circlePoly(knob.center, knob.radius, 64),
  circlePoly(PL, hubRadius.lower - 2, 96));

const turnAbout = (mp, c, a) => (a ? transformPolygon(mp, c, a * deg) : mp);
// Deliberate departure (pass 95): with Brown's castings the held lower handle
// stands at 73.9 deg, where the band's left end rests on the wing's rim (an
// arc about the upper shaft, so the hold does not depend on the wing's drop);
// the ball lever then points straight at the upper shaft and its ball lies
// across the upper boss for 45% of the cycle. The quadrant (band, web and
// window) is therefore cast 14 deg clockwise of Brown's on the lower hub,
// relative to his ball lever: the band's end passes the wing 14 deg sooner,
// the hold is 59.9 deg, and the ball stands 15 px clear of the boss, over
// the C-arm. The ball lever keeps Brown's pose; the latch is unchanged.
export const lowerCastingTurn = Object.freeze({ quadrant: 14, lever: 0 });

export function quadrantCatchParts() {
  const upper = { pivot: PU, dir: +1, limits: [-30, upperFreeStop], parts: {} };
  const lower = { pivot: PL, dir: -1, limits: [0, 80], parts: {} };
  upper.parts.hub = { planes: 'BAF', poly: circlePoly(PU, hubRadius.upper) };
  lower.parts.hub = { planes: 'WRBAFH', poly: circlePoly(PL, hubRadius.lower) };
  // The band's rims are true arcs about the lower shaft.
  lower.parts.quadrant = { planes: 'F', poly: turnAbout(polygonClipping.intersection(lowerQuadrantOutline(), circlePoly(PL, bandRadius, 512)), PL, lowerCastingTurn.quadrant) };
  lower.parts.lever = { planes: 'H', poly: turnAbout(leverOutline(), PL, lowerCastingTurn.lever) };
  lower.parts.weightArm = { planes: 'W', poly: tangentLever(PL, 24, eyes.lower, eyeRadius) };
  // The wing's outer rim is a true arc about the upper shaft; its toe is cut
  // to the band's rim, on which it rests in the plate pose.
  // The wing stops 1 px inside the boss, so its cut face is buried in the
  // boss and no bore wall doubles the boss's own.
  upper.parts.wing = { planes: 'F', poly: diff(polygonClipping.intersection(upperWingOutline(), circlePoly(PU, rimRadius, 512)),
    circlePoly(PL, bandRadius + 0.4, 512), circlePoly(PU, hubRadius.upper - 1, 128)) };
  upper.parts.arm = { planes: 'A', poly: union(upperArmOutline(), circlePoly(PU, hubRadius.upper - 2)) };
  upper.parts.weightArm = { planes: 'B', poly: tangentLever(PU, 20, eyes.upper, eyeRadius) };
  upper.eye = [...eyes.upper];
  lower.eye = [...eyes.lower];
  return { upper, lower };
}

export function transformPolygon(mp, pivot, angle) {
  return mp.map((poly) => poly.map((ring) => ring.map((p) => {
    const r = rot([p[0] - pivot[0], p[1] - pivot[1]], angle);
    return [r[0] + pivot[0], r[1] + pivot[1]];
  })));
}
function area(mp) {
  let s = 0;
  for (const poly of mp) poly.forEach((ring, k) => {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    s += Math.abs(a) / 2 * (k ? -1 : 1);
  });
  return s;
}
function bounds(mp) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of mp) for (const r of p) for (const q of r) {
    x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
  }
  return [x0, y0, x1, y1];
}
export function overlapArea(a, b) {
  const A = bounds(a), B = bounds(b);
  if (A[2] < B[0] || B[2] < A[0] || A[3] < B[1] || B[3] < A[1]) return 0;
  return area(polygonClipping.intersection(a, b));
}
const shares = (a, b) => [...a].some((c) => b.includes(c));
export const tappetPolygon = (T) => P([[tappetSource.x0, T], [tappetSource.x1, T],
  [tappetSource.x1, T + tappetSource.h], [tappetSource.x0, T + tappetSource.h]]);
export const tappetTopAtPhase = (phase) => (strokeSource.top + strokeSource.bottom) / 2
  + (strokeSource.bottom - strokeSource.top) / 2 * Math.cos(2 * Math.PI * phase);

// Overlap (px^2) of one handle at `angle` against the tappet and the other
// handle, restricted to parts that share a plane.
export function handleOverlap(body, angle, other, otherAngle, T) {
  let total = 0;
  const tappet = tappetPolygon(T);
  for (const part of Object.values(body.parts)) {
    const moved = transformPolygon(part.poly, body.pivot, angle * deg);
    if (shares(part.planes, TAPPET_PLANES)) total += overlapArea(moved, tappet);
    for (const otherPart of Object.values(other.parts)) {
      if (shares(part.planes, otherPart.planes)) {
        total += overlapArea(moved, transformPolygon(otherPart.poly, other.pivot, otherAngle * deg));
      }
    }
  }
  return total;
}

const smoothStep = (x) => { const v = Math.min(1, Math.max(0, x)); return v * v * v * (10 + v * (-15 + 6 * v)); };
// Inferred: how far the blow throws the lower handle, the upper valve stop,
// how far the return blow throws the upper handle, and their durations
// (samples of a 720-sample cycle at samples = 720).
export const cycleSettings = Object.freeze({ lowerThrow: 76 - lowerCastingTurn.quadrant, throwFraction: 8 / 360, dropFraction: 16 / 360,
  backFraction: 10 / 360, upperBack: -1.5 });

// The lower handle falls from `from` against the wing at `u` (no tappet).
export function lowerLockAngle(upper, lower, u, from) {
  let l = from;
  while (l > 0 && handleOverlap(lower, l - 0.05, upper, u, 1000) < 0.002) l -= 0.05;
  return l;
}

// One tappet cycle as a sequence: contacts with the tappet are solved from
// the polygons, the weighted drops and the two throws follow smooth timed
// laws, and the tests check every pose for clearance.
export function solveQuadrantCatchCycle({ samples = 720, cycles = 2 } = {}) {
  const { upper, lower } = quadrantCatchParts();
  const none = { pivot: PU, parts: {} };
  const ov = (body, x, other, oa, T) => handleOverlap(body, x, other, oa, T);
  // Turn a body against its weight until the tappet clears it.
  const pushClear = (body, x, T) => {
    if (ov(body, x, none, 0, T) < 0.002) return x;
    let lo = x, hi = x;
    for (let k = 1; k < 2000; k++) { hi = x - body.dir * k * 0.05; if (ov(body, hi, none, 0, T) < 0.0005) break; }
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ov(body, m, none, 0, T) < 0.0005) hi = m; else lo = m; }
    return hi;
  };
  // Let a body turn toward `target` until its first contact.
  const fallTo = (body, x, target, other, oa, T) => {
    if (ov(body, target, other, oa, T) < 0.002) return target;
    let lo = x, hi = target;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ov(body, m, other, oa, T) < 0.002) lo = m; else hi = m; }
    return lo;
  };
  const S = cycleSettings, rows = [], modes = [];
  const steps = (f) => Math.max(2, Math.round(f * samples));
  let mode = 'ride', u = 0, l = 0, t0 = 0, from = 0, pushed = false, lock = null;
  for (let i = 0; i <= samples * cycles; i++) {
    const phase = i / samples, T = tappetTopAtPhase(phase), rising = (phase % 1) < 0.5;
    if (mode === 'ride') {
      // The ball lever lies on the tappet or its stop; the wing's toe rests
      // on the band's rim (or settles back onto it after the return throw).
      const lifted = pushClear(lower, l, T), wasPushed = pushed;
      pushed = lifted > l + 1e-9;
      if (pushed) l = lifted; else l = fallTo(lower, l, Math.max(0, l - 3), upper, u, T);
      if (u < 0) u = Math.min(0, u + 0.25 * 720 / samples);
      if (rising && wasPushed && !pushed && l > 40) { mode = 'throw'; t0 = i; from = l; }
    }
    if (mode === 'throw') {
      const k = (i - t0) / steps(S.throwFraction);
      l = from + (S.lowerThrow - from) * smoothStep(k);
      if (k >= 1) { mode = 'drop'; t0 = i; lock = lowerLockAngle(upper, lower, upperFreeStop, S.lowerThrow); }
    }
    if (mode === 'drop') {
      const k = (i - t0) / steps(S.dropFraction);
      u = upperFreeStop * smoothStep(k);
      l = S.lowerThrow + (lock - S.lowerThrow) * smoothStep((k - 0.55) / 0.45);
      if (k >= 1) { mode = 'held'; u = upperFreeStop; l = lock; }
    } else if (mode === 'held') {
      const struck = pushClear(upper, u, T);
      if (struck < u - 1e-9) {
        u = struck;
        // The wing, turned back by the blow, lifts the band's end with it.
        if (ov(lower, l, upper, u, T) >= 0.002) {
          let hi = l;
          for (let k = 1; k < 400 && ov(lower, hi, upper, u, T) >= 0.0005; k++) hi = l + k * 0.05;
          l = hi;
        }
      } else if (u < upperFreeStop - 0.5) { mode = 'back'; t0 = i; from = u; }
    }
    if (mode === 'back') {
      const k = (i - t0) / steps(S.backFraction);
      u = from + (S.upperBack - from) * smoothStep(k);
      l = fallTo(lower, l, Math.max(0, l - 3 * 720 / samples), upper, u, T);
      if (k >= 1) { mode = 'ride'; pushed = false; }
    }
    if (i >= samples * (cycles - 1)) { rows.push([T, u, l]); modes.push(mode); }
  }
  return { samples, rows, modes };
}
