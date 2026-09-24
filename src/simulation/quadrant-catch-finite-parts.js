// Plate-measured parts and quasistatic transfer solver for 183/184 (two
// quadrant hand gear). Coordinates are engraving pixels of plate 183 (y down,
// angles clockwise on the page). Plate 184 draws the same gear at the top of
// the stroke with both pivots 33 px higher; it is modelled as the same rigid
// parts at the top of the solved cycle.
//
// Axial layers (back to front): weight rods, lower back-weight arm (W), piston
// rod (R), upper arm (A), the lower quadrant's hidden rear lip (N), upper wing
// (X), lower quadrant (Y), lower arm (B). The tappet projects from the rod
// through A..B.
//
// Catches: a stud on the hidden part of the upper arm (A..N) sits under the
// lower quadrant's rear lip, hidden behind the drawn band end; a stud on the
// back of the lower band's left end (X..Y) bears on the upper wing's toe at
// the top. The lip is concentric with the lower shaft, so the held upper stud
// does not load the lower handle until the lip's end passes it; the toe load
// presses the upper handle onto its valve stop. The back weights (not solved as
// forces) are represented by each handle moving in its weighted direction
// whenever no contact prevents it.
import polygonClipping from 'polygon-clipping';

export const deg = Math.PI / 180;
export const PU = Object.freeze([275, 128]);
export const PL = Object.freeze([283, 353]);
export const sourceScale = 0.0125;
export const tappetSource = Object.freeze({ x0: 170, x1: 189, h: 42 });
export const strokeSource = Object.freeze({ top: 86, bottom: 345, source183: 330 });
export const upperFreeStop = 45;
export const pinRadius = 6;
export const studs = Object.freeze({ upper: Object.freeze([238, 265]), lower: Object.freeze([241.9, 230.7]) });

const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const P = (pts) => [[[...pts, pts[0]]]];
const polar = (c, r, a) => [c[0] + r * Math.cos(a * deg), c[1] + r * Math.sin(a * deg)];
export const circlePoints = (c, r, n = 48) => Array.from({ length: n }, (_, i) => [
  c[0] + r * Math.cos(2 * Math.PI * i / n), c[1] + r * Math.sin(2 * Math.PI * i / n)]);
const arc = (c, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => polar(c, r, a0 + (a1 - a0) * i / n));
const sector = (c, r0, r1, a0, a1, n = 24) => P([...arc(c, r1, a0, a1, n), ...arc(c, r0, a1, a0, n)]);
const union = (...a) => polygonClipping.union(...a);
const diff = (a, ...b) => polygonClipping.difference(a, ...b);

function smooth(pts, sub = 6) {
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
function band(centerline, halfWidths) {
  const pts = smooth(centerline), left = [], right = [];
  pts.forEach((p, i) => {
    const s = i / (pts.length - 1) * (halfWidths.length - 1), k = Math.min(Math.floor(s), halfWidths.length - 2);
    const w = halfWidths[k] + (halfWidths[k + 1] - halfWidths[k]) * (s - k);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = [b[0] - a[0], b[1] - a[1]], n = Math.hypot(...d), nn = [-d[1] / n, d[0] / n];
    left.push([p[0] + nn[0] * w, p[1] + nn[1] * w]);
    right.push([p[0] - nn[0] * w, p[1] - nn[1] * w]);
  });
  return P([...left, ...right.reverse()]);
}

// Outlines traced from plate 183 (scripts are not kept: ink faces of each
// casting were filled, split at the hub and smoothed by 1.6 px). Coordinates
// are plate pixels in each handle's own frame (upper un-rotated from its
// 0.6 deg plate pose). The upper casting is a C-shaped arm (hidden behind the
// lower quadrant, ending in Brown's hooked tip) and a pointed-window wing
// whose outer rim is concentric with its shaft; the lower quadrant is a band
// with squared ends and an anvil window between two curved web arms.
// upperArm: outer 1, holes 0
const upperArmTrace = Object.freeze([[[[245.4, 112.5], [244.5, 112.6], [243.2, 113.9], [241.8, 117.9], [240.6, 122.9], [240.5, 131.8], [239.9, 133.6], [235.5, 137], [224.8, 152], [220.3, 160.1], [217.1, 169.1], [216, 180.1], [216.2, 186.1], [217.4, 193.1], [220.1, 202.1], [223.9, 210], [228, 217], [228.7, 227], [230.6, 237], [230.6, 241], [224.9, 261], [216.6, 282.1], [215.6, 289.1], [213.2, 290.9], [205.2, 291.7], [203.5, 292.7], [202.5, 294.3], [202.3, 299.3], [202.8, 302.3], [204.5, 304.8], [207.4, 306], [213.4, 305.8], [217.4, 304.3], [219.3, 302.9], [225.1, 297], [233.3, 285.9], [238.9, 279.9], [240.7, 275.9], [245.5, 255.8], [247.6, 236.8], [247.4, 221.8], [240.3, 205.9], [236.6, 194.9], [235.3, 188.9], [235.2, 182.9], [237.7, 174.9], [240.6, 169.9], [243.9, 165.9], [247.9, 162.8], [251.8, 160.8], [254.8, 159.9], [257.8, 159.9], [270.9, 162.5], [275.6, 162.3], [276.6, 161.3], [276.6, 159.7], [275.6, 158.7], [268.8, 158.2], [263.8, 156.6], [259.8, 154.3], [253.8, 149.7], [249.3, 143.8], [246.9, 138.8], [245.6, 132.8], [245.6, 122.8], [248.2, 114.2], [247.2, 113.1]]]]);
// upperWing: outer 1, holes 1
const upperWingTrace = Object.freeze([[[[380.5, 37.5], [376.6, 37.6], [358.6, 40.8], [353.8, 42.3], [351.9, 44.7], [349.9, 49.7], [349.9, 52.7], [351.6, 57.7], [351.2, 59.5], [349.7, 60.9], [336.9, 67.6], [320, 77.5], [306, 84.7], [300.1, 88.7], [288.2, 94.8], [285.2, 95.3], [280.1, 94.5], [268.1, 94.6], [262.2, 96.1], [258.2, 97.7], [250.2, 102.9], [246.7, 106.8], [245.1, 109.6], [245.2, 110.4], [246.4, 111.5], [249.3, 112], [255.3, 105.9], [261.2, 101.7], [267.2, 99.3], [271.2, 98.6], [280.2, 98.5], [286.2, 100.1], [293.2, 104], [298.1, 108.3], [302.9, 115.2], [305.3, 122.2], [305.5, 133.2], [303.6, 140.2], [299.3, 147.2], [295.7, 151.1], [287.8, 156.3], [279.1, 158.7], [278.1, 159.7], [278.1, 161.2], [278.5, 161.8], [279.9, 162], [289.8, 159.5], [292.6, 159.9], [295.1, 162.5], [309, 172.3], [320.1, 183], [328.2, 192.9], [332.9, 202.9], [334.4, 212.9], [334.3, 215.9], [332.6, 223.9], [332.6, 226.8], [333.2, 228.3], [352.7, 237.5], [355.7, 237.6], [358.7, 236.8], [372.5, 224.7], [374.5, 223.7], [378.5, 222.8], [380.3, 221.3], [381.2, 219.4], [381.9, 215.4], [383.5, 212.4], [388.5, 205.5], [393.3, 203.1], [394.7, 200.9], [395.8, 197.5], [398.9, 194.1], [403.7, 184.1], [404.2, 172.2], [405.2, 170.7], [407.7, 169.9], [408.7, 168.9], [408.7, 167.2], [406.9, 163.1], [406.9, 157.1], [409.4, 151.1], [410.5, 144.1], [411.5, 131.1], [411.3, 117.1], [410.5, 112.1], [410.9, 110.3], [413, 107.8], [413, 106.3], [410.5, 103.8], [409.5, 102.1], [408.8, 98.1], [402.6, 77.2], [398.9, 69.2], [396, 65.2], [389.9, 48.3], [383.9, 39.4], [382.4, 38]], [[377.1, 89.9], [378.9, 90.7], [380.1, 92.4], [385.1, 109.3], [386.4, 117.3], [386.5, 139.3], [384.6, 150.3], [378.9, 169.4], [375.2, 178.4], [367.8, 192.5], [363.2, 198.5], [360.3, 200.1], [359.5, 199.9], [358.5, 198.6], [357.8, 194.6], [354.8, 185.7], [348.6, 175.7], [338.7, 164.2], [329.8, 156.3], [320.8, 149.8], [319.3, 148], [318.7, 145], [319.6, 139], [319.6, 128], [320.7, 125.2], [322.5, 124.1], [338.4, 118], [350.3, 111.7], [362.2, 102.4], [371.2, 93.8], [375.1, 90.7]]]]);
// lowerQuadrant: outer 1, holes 1
const lowerQuadrantTrace = Object.freeze([[[[194.1, 251.9], [193.6, 255.5], [194.9, 260.5], [202.6, 276.4], [203.7, 277.9], [206.5, 278.3], [210.5, 276.7], [212.5, 276.6], [217.5, 277.8], [224.5, 280.9], [232.8, 287.6], [240.5, 298.5], [243.7, 304.5], [249.1, 318.5], [251.7, 331.3], [253.6, 332.4], [256.5, 331.3], [261.5, 326.9], [265.5, 324.3], [275.5, 319.9], [281.5, 318.6], [285.5, 318.7], [292.5, 319.9], [299.5, 323.3], [306.5, 327.9], [309.4, 328.4], [310.9, 327.9], [313.9, 313.5], [316.5, 305.5], [319.8, 297.5], [323.9, 290.5], [329.5, 283.6], [338.5, 277], [344.5, 274.7], [356.5, 274.5], [358.9, 273.9], [363.1, 262.5], [366.1, 251.5], [366.5, 248.5], [365.6, 244.6], [363.4, 242.3], [346.5, 232.8], [332.5, 227.2], [316.5, 222.6], [308.5, 221.3], [302.5, 219.7], [292.5, 218.5], [273.5, 218.5], [256.5, 220.7], [235.5, 226], [221.5, 232.8], [203.5, 243.9]], [[234.8, 252.9], [240.5, 250], [251.5, 245.9], [269.5, 242.6], [286.5, 242.5], [301.5, 244.7], [306.5, 245.9], [319.5, 250.5], [322.3, 252], [323.2, 254.5], [322.3, 256.1], [316.5, 260.6], [308.5, 268.5], [302.9, 275.5], [297.9, 285.5], [292.9, 298.5], [290.9, 305.4], [288.5, 307.1], [284.5, 306.6], [273.5, 306.4], [271.1, 305.3], [265.2, 290.5], [261.7, 283.5], [256.1, 274.5], [249.4, 266.7], [242.4, 261.3], [234.9, 257.3], [233.9, 254.6]]]]);

const seatGap = 1.0;
// Angular reach of the lower quadrant's hidden rear lip (degrees, about PL).
// It stays inside the drawn band end so it is hidden behind the front plate.
export const lipSpan = Object.freeze([-136, -114.5]);
const lipLeadIn = -128;
const rimRadius = 137.5;
const catchBossRadii = Object.freeze([121, rimRadius]);
export const catchBossSpan = Object.freeze([-6, 22]);

export function quadrantCatchParts() {
  const us = studs.upper, ls = studs.lower;
  const noseR = Math.hypot(us[0] - PL[0], us[1] - PL[1]) + pinRadius + seatGap;
  const upper = { pivot: PU, dir: +1, limits: [-30, upperFreeStop], parts: {} };
  const lower = { pivot: PL, dir: -1, limits: [0, 90], parts: {} };
  upper.parts.hub = { planes: 'AMNXYB', poly: P(circlePoints(PU, 34, 96)) };
  lower.parts.hub = { planes: 'WRAMNXYB', poly: P(circlePoints(PL, 35, 96)) };
  // Upper arm: the traced C-arm and hooked tip, behind both quadrants.
  upper.parts.arm = { planes: 'A', poly: upperArmTrace };
  // Hidden stud on the arm (Brown dashes the arm here) reaching the lower lip.
  upper.parts.stud = { planes: 'AN', poly: P(circlePoints(us, pinRadius, 48)) };
  lower.parts.arm = { planes: 'B', poly: band(
    [[262, 352], [240, 345], [220, 332], [203, 318], [188, 309], [160, 306], [120, 306], [90, 307], [78, 307]],
    [12, 11.5, 11, 10, 8, 6.5, 6.5, 6.5, 6.5]) };
  lower.parts.knob = { planes: 'B', poly: P(circlePoints([75, 307], 11.5, 48)) };
  // Hidden stud on the back of the band's left end, reaching into the wing's
  // plane: at the top it bears on the upper wing's toe.
  lower.parts.stud = { planes: 'MN', poly: P(circlePoints(ls, pinRadius, 96)) };
  // Lower quadrant: the traced front plate. Its hidden rear lip, concentric
  // with the lower shaft, holds the upper stud until the lip's end passes it.
  lower.parts.quadrant = { planes: 'Y', poly: lowerQuadrantTrace };
  // The lip's inner face is concentric (radius noseR) except for a lead-in at
  // its leading end, which cams the upper stud home as the lower handle falls.
  const lipInner = Array.from({ length: 49 }, (_, i) => {
    const a = lipSpan[1] + (lipSpan[0] - lipSpan[1]) * i / 48;
    const t = Math.min(1, Math.max(0, (lipLeadIn - a) / (lipLeadIn - lipSpan[0])));
    return polar(PL, noseR + 8 * t * t * (3 - 2 * t), a);
  });
  lower.parts.lip = { planes: 'N', poly: P([...arc(PL, 124, lipSpan[0], lipSpan[1], 48), ...lipInner]) };
  lower.parts.weightArm = { planes: 'W', poly: union(P([[256, 364], [150, 412], [155, 430], [292, 388]]), P(circlePoints([142, 421], 11, 48))) };
  lower.eye = [142, 421];
  // Upper wing: traced plate, its outer rim trimmed to the concentric arc,
  // and the weight-rod eye at the rim's tab.
  const rim = P(circlePoints(PU, rimRadius, 192));
  const eyeNeck = union(P(circlePoints([400, 43], 10, 48)), P([[378, 42], [396, 36], [404, 50], [384, 56]]));
  upper.parts.quadrant = { planes: 'X', poly: union(polygonClipping.intersection(upperWingTrace, rim), eyeNeck) };
  // Front boss on the wing's rim, inside its drawn outline: its outer face is
  // concentric with the upper shaft and holds the lower stud at the top.
  upper.parts.catchBoss = { planes: 'M', poly: sector(PU, catchBossRadii[0], rimRadius, catchBossSpan[0], catchBossSpan[1], 256) };
  upper.eye = [400, 43];
  return { upper, lower, noseR };
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
// handle, restricted to parts that share an axial layer.
export function handleOverlap(body, angle, other, otherAngle, T, ignore = null) {
  let total = 0;
  const tappet = tappetPolygon(T);
  for (const part of Object.values(body.parts)) {
    const moved = transformPolygon(part.poly, body.pivot, angle * deg);
    if (shares(part.planes, 'AMNXYB')) total += overlapArea(moved, tappet);
    for (const otherPart of Object.values(other.parts)) {
      if (ignore && ignore(part, otherPart)) continue;
      
      if (shares(part.planes, otherPart.planes)) {
        total += overlapArea(moved, transformPolygon(otherPart.poly, other.pivot, otherAngle * deg));
      }
    }
  }
  return total;
}

// Quasistatic transfer: each step the handles are pushed clear of the tappet
// and each other's catches, then fall toward their back-weighted direction at
// a limited rate until the first contact or their undrawn valve stop.
export function solveQuadrantCatchCycle({ samples = 720, rate = 3, cycles = 2 } = {}) {
  const parts = quadrantCatchParts(), { upper, lower } = parts;
  // The falling lower handle's lip may cam the upper stud home through its
  // lead-in: the lower back weight is taken to overpower the upper one, so
  // that pair is resolved by moving the upper handle.
  const camIn = (part, otherPart) => part === lower.parts.lip && otherPart === upper.parts.stud;
  const resolve = (body, angle, other, otherAngle, T, step) => {
    const ignore = body === lower ? camIn : null;
    const clear = (x) => handleOverlap(body, x, other, otherAngle, T, ignore) < 0.04;
    const tight = (x) => handleOverlap(body, x, other, otherAngle, T, ignore) < 0.005;
    // A falling handle settles a little shy of the contact tolerance, so a
    // concentric catch face can then slide under it without binding.
    const settled = (x) => handleOverlap(body, x, other, otherAngle, T, ignore) < 0.002;
    if (!clear(angle)) {
      let lo = angle, hi = angle;
      for (let k = 1; k < 400; k++) { hi = angle - body.dir * k * 0.5; if (clear(hi)) break; }
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (tight(m)) hi = m; else lo = m; }
      return hi;
    }
    const target = body.dir > 0 ? Math.min(body.limits[1], angle + step) : Math.max(body.limits[0], angle - step);
    const atLimit = target === body.limits[0] || target === body.limits[1];
    if (atLimit ? tight(target) : clear(target)) return target;
    let lo = angle, hi = target;
    if (!tight(lo)) return lo;
    if (!settled(lo)) return lo;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (settled(m)) lo = m; else hi = m; }
    return lo;
  };
  let u = 0, l = 0;
  const rows = [];
  for (let i = 0; i <= samples * cycles; i++) {
    const phase = i / samples, T = tappetTopAtPhase(phase);
    for (let k = 0; k < 2; k++) {
      l = resolve(lower, l, upper, u, T, k ? 0 : rate);
      u = resolve(upper, u, lower, l, T, k ? 0 : rate);
    }
    if (i >= samples * (cycles - 1)) rows.push([T, u, l]);
  }
  return { samples, rows, noseR: parts.noseR };
}
