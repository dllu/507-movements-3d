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

// Outlines traced from plate 183 (upper un-rotated from its 0.6 deg plate
// pose): the upper C-arm with Brown's hooked tip, the upper pointed-window
// wing, and the lower band with its anvil window between two curved webs.
const upperArmTrace = Object.freeze([[[[245.4, 112.5], [244.5, 112.6], [243.2, 113.9], [241.8, 117.9], [240.6, 122.9], [240.5, 131.8], [239.9, 133.6], [235.5, 137], [224.8, 152], [220.3, 160.1], [217.1, 169.1], [216, 180.1], [216.2, 186.1], [217.4, 193.1], [220.1, 202.1], [223.9, 210], [228, 217], [228.7, 227], [230.6, 237], [230.6, 241], [224.9, 261], [216.6, 282.1], [215.6, 289.1], [213.2, 290.9], [205.2, 291.7], [203.5, 292.7], [202.5, 294.3], [202.3, 299.3], [202.8, 302.3], [204.5, 304.8], [207.4, 306], [213.4, 305.8], [217.4, 304.3], [219.3, 302.9], [225.1, 297], [233.3, 285.9], [238.9, 279.9], [240.7, 275.9], [245.5, 255.8], [247.6, 236.8], [247.4, 221.8], [240.3, 205.9], [236.6, 194.9], [235.3, 188.9], [235.2, 182.9], [237.7, 174.9], [240.6, 169.9], [243.9, 165.9], [247.9, 162.8], [251.8, 160.8], [254.8, 159.9], [257.8, 159.9], [270.9, 162.5], [275.6, 162.3], [276.6, 161.3], [276.6, 159.7], [275.6, 158.7], [268.8, 158.2], [263.8, 156.6], [259.8, 154.3], [253.8, 149.7], [249.3, 143.8], [246.9, 138.8], [245.6, 132.8], [245.6, 122.8], [248.2, 114.2], [247.2, 113.1]]]]);
const upperWingTrace = Object.freeze([[[[380.5, 37.5], [376.6, 37.6], [358.6, 40.8], [353.8, 42.3], [351.9, 44.7], [349.9, 49.7], [349.9, 52.7], [351.6, 57.7], [351.2, 59.5], [349.7, 60.9], [336.9, 67.6], [320, 77.5], [306, 84.7], [300.1, 88.7], [288.2, 94.8], [285.2, 95.3], [280.1, 94.5], [268.1, 94.6], [262.2, 96.1], [258.2, 97.7], [250.2, 102.9], [246.7, 106.8], [245.1, 109.6], [245.2, 110.4], [246.4, 111.5], [249.3, 112], [255.3, 105.9], [261.2, 101.7], [267.2, 99.3], [271.2, 98.6], [280.2, 98.5], [286.2, 100.1], [293.2, 104], [298.1, 108.3], [302.9, 115.2], [305.3, 122.2], [305.5, 133.2], [303.6, 140.2], [299.3, 147.2], [295.7, 151.1], [287.8, 156.3], [279.1, 158.7], [278.1, 159.7], [278.1, 161.2], [278.5, 161.8], [279.9, 162], [289.8, 159.5], [292.6, 159.9], [295.1, 162.5], [309, 172.3], [320.1, 183], [328.2, 192.9], [332.9, 202.9], [334.4, 212.9], [334.3, 215.9], [332.6, 223.9], [332.6, 226.8], [333.2, 228.3], [352.7, 237.5], [355.7, 237.6], [358.7, 236.8], [372.5, 224.7], [374.5, 223.7], [378.5, 222.8], [380.3, 221.3], [381.2, 219.4], [381.9, 215.4], [383.5, 212.4], [388.5, 205.5], [393.3, 203.1], [394.7, 200.9], [395.8, 197.5], [398.9, 194.1], [403.7, 184.1], [404.2, 172.2], [405.2, 170.7], [407.7, 169.9], [408.7, 168.9], [408.7, 167.2], [406.9, 163.1], [406.9, 157.1], [409.4, 151.1], [410.5, 144.1], [411.5, 131.1], [411.3, 117.1], [410.5, 112.1], [410.9, 110.3], [413, 107.8], [413, 106.3], [410.5, 103.8], [409.5, 102.1], [408.8, 98.1], [402.6, 77.2], [398.9, 69.2], [396, 65.2], [389.9, 48.3], [383.9, 39.4], [382.4, 38]], [[377.1, 89.9], [378.9, 90.7], [380.1, 92.4], [385.1, 109.3], [386.4, 117.3], [386.5, 139.3], [384.6, 150.3], [378.9, 169.4], [375.2, 178.4], [367.8, 192.5], [363.2, 198.5], [360.3, 200.1], [359.5, 199.9], [358.5, 198.6], [357.8, 194.6], [354.8, 185.7], [348.6, 175.7], [338.7, 164.2], [329.8, 156.3], [320.8, 149.8], [319.3, 148], [318.7, 145], [319.6, 139], [319.6, 128], [320.7, 125.2], [322.5, 124.1], [338.4, 118], [350.3, 111.7], [362.2, 102.4], [371.2, 93.8], [375.1, 90.7]]]]);
const lowerQuadrantTrace = Object.freeze([[[[194.1, 251.9], [193.6, 255.5], [194.9, 260.5], [202.6, 276.4], [203.7, 277.9], [206.5, 278.3], [210.5, 276.7], [212.5, 276.6], [217.5, 277.8], [224.5, 280.9], [232.8, 287.6], [240.5, 298.5], [243.7, 304.5], [249.1, 318.5], [251.7, 331.3], [253.6, 332.4], [256.5, 331.3], [261.5, 326.9], [265.5, 324.3], [275.5, 319.9], [281.5, 318.6], [285.5, 318.7], [292.5, 319.9], [299.5, 323.3], [306.5, 327.9], [309.4, 328.4], [310.9, 327.9], [313.9, 313.5], [316.5, 305.5], [319.8, 297.5], [323.9, 290.5], [329.5, 283.6], [338.5, 277], [344.5, 274.7], [356.5, 274.5], [358.9, 273.9], [363.1, 262.5], [366.1, 251.5], [366.5, 248.5], [365.6, 244.6], [363.4, 242.3], [346.5, 232.8], [332.5, 227.2], [316.5, 222.6], [308.5, 221.3], [302.5, 219.7], [292.5, 218.5], [273.5, 218.5], [256.5, 220.7], [235.5, 226], [221.5, 232.8], [203.5, 243.9]], [[234.8, 252.9], [240.5, 250], [251.5, 245.9], [269.5, 242.6], [286.5, 242.5], [301.5, 244.7], [306.5, 245.9], [319.5, 250.5], [322.3, 252], [323.2, 254.5], [322.3, 256.1], [316.5, 260.6], [308.5, 268.5], [302.9, 275.5], [297.9, 285.5], [292.9, 298.5], [290.9, 305.4], [288.5, 307.1], [284.5, 306.6], [273.5, 306.4], [271.1, 305.3], [265.2, 290.5], [261.7, 283.5], [256.1, 274.5], [249.4, 266.7], [242.4, 261.3], [234.9, 257.3], [233.9, 254.6]]]]);

// Brown's ball lever: a straight bar from the ball to a broad crook that
// wraps under the web into the hub (plate 183 edges, px).
const leverUpper = [[75, 300.5], [150, 300.5], [176, 301], [190, 305], [202, 317], [214, 330], [229, 335], [252, 337]];
const leverLower = [[75, 313.5], [150, 313.5], [174, 314], [186, 321], [196, 334], [205, 350], [215, 363], [230, 371], [256, 374]];
const leverOutline = () => union(P([...smooth(leverUpper), ...smooth(leverLower).reverse()]), circlePoly(knob.center, knob.radius, 64),
  circlePoly(PL, hubRadius.lower - 2, 96));

export function quadrantCatchParts() {
  const upper = { pivot: PU, dir: +1, limits: [-30, upperFreeStop], parts: {} };
  const lower = { pivot: PL, dir: -1, limits: [0, 80], parts: {} };
  upper.parts.hub = { planes: 'BAF', poly: circlePoly(PU, hubRadius.upper) };
  lower.parts.hub = { planes: 'WRBAFH', poly: circlePoly(PL, hubRadius.lower) };
  // The band's rims are true arcs about the lower shaft.
  lower.parts.quadrant = { planes: 'F', poly: polygonClipping.intersection(lowerQuadrantTrace, circlePoly(PL, bandRadius, 512)) };
  lower.parts.lever = { planes: 'H', poly: leverOutline() };
  lower.parts.weightArm = { planes: 'W', poly: tangentLever(PL, 24, eyes.lower, eyeRadius) };
  // The wing's outer rim is a true arc about the upper shaft; its toe is cut
  // to the band's rim, on which it rests in the plate pose.
  upper.parts.wing = { planes: 'F', poly: diff(polygonClipping.intersection(upperWingTrace, circlePoly(PU, rimRadius, 512)),
    circlePoly(PL, bandRadius + 0.4, 512)) };
  upper.parts.arm = { planes: 'A', poly: union(upperArmTrace, circlePoly(PU, hubRadius.upper - 2)) };
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
export const cycleSettings = Object.freeze({ lowerThrow: 76, throwFraction: 8 / 360, dropFraction: 16 / 360,
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
