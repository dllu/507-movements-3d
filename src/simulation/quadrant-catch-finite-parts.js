// Plate-measured parts and quasistatic transfer solver for 183/184 (two
// quadrant hand gear). Coordinates are engraving pixels of plate 183 (y down,
// angles clockwise on the page). Plate 184 draws the same gear at the top of
// the stroke with both pivots 33 px higher; it is modelled as the same rigid
// parts at the top of the solved cycle.
//
// Axial layers (back to front): weight rods, lower back-weight arm (W), piston
// rod (R), upper working arm (A), upper quadrant (X), lower quadrant (Y),
// lower working arm (B). The tappet projects from the rod through A..B.
//
// Catches: a stud on the hidden part of the upper handle's arm (A..Y) sits
// under the lower quadrant's nosed rim; a stud on the lower handle's arm
// (X..B) sits under the upper quadrant's toe. Both rim faces are concentric
// with their own pivots, so a held stud does not load the holding handle until
// the rim's end passes it. The back weights (not solved as forces) are
// represented by each handle moving in its weighted direction whenever no
// contact prevents it.
import polygonClipping from 'polygon-clipping';

export const deg = Math.PI / 180;
export const PU = Object.freeze([275, 128]);
export const PL = Object.freeze([283, 353]);
export const sourceScale = 0.0125;
export const tappetSource = Object.freeze({ x0: 170, x1: 189, h: 42 });
export const strokeSource = Object.freeze({ top: 86, bottom: 345, source183: 330 });
export const upperFreeStop = 55;
export const pinRadius = 6;
export const studs = Object.freeze({ upper: Object.freeze([238, 265]), lower: Object.freeze([160, 306]) });

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

// Lower handle's latched lift, used to size the upper quadrant toe so the
// lower stud rests just outside its concentric face.
const lowerLatchedLift = 54.72;
const seatGap = 1.0;

export function quadrantCatchParts() {
  const us = studs.upper, ls = studs.lower;
  const noseR = Math.hypot(us[0] - PL[0], us[1] - PL[1]) + pinRadius + seatGap;
  const lw = rot([ls[0] - PL[0], ls[1] - PL[1]], lowerLatchedLift * deg);
  const toeR = Math.hypot(lw[0] + PL[0] - PU[0], lw[1] + PL[1] - PU[1]) + pinRadius + seatGap;
  const upper = { pivot: PU, dir: +1, limits: [-30, upperFreeStop], parts: {} };
  const lower = { pivot: PL, dir: -1, limits: [0, 90], parts: {} };
  upper.parts.hub = { planes: 'AXYB', poly: P(circlePoints(PU, 34, 96)) };
  lower.parts.hub = { planes: 'WRAXYB', poly: P(circlePoints(PL, 35, 96)) };
  upper.parts.arm = { planes: 'A', poly: band(
    [[262, 120], [246, 140], [233, 165], [231, 190], [240, 212], [249, 235], [247, 258], [238, 277], [225, 290], [214, 295]],
    [8, 8, 8, 7.5, 7, 7, 6.5, 6.5, 6.5, 6.5]) };
  upper.parts.knob = { planes: 'A', poly: P(circlePoints([212, 295], 9, 48)) };
  upper.parts.stud = { planes: 'AXY', poly: P(circlePoints(us, pinRadius, 48)) };
  lower.parts.arm = { planes: 'B', poly: band(
    [[262, 352], [240, 345], [220, 332], [203, 318], [188, 309], [160, 306], [120, 306], [90, 307], [78, 307]],
    [12, 11.5, 11, 10, 8, 6.5, 6.5, 6.5, 6.5]) };
  lower.parts.knob = { planes: 'B', poly: P(circlePoints([75, 307], 11.5, 48)) };
  lower.parts.stud = { planes: 'BXY', poly: P(circlePoints(ls, pinRadius, 48)) };
  // Lower quadrant: narrow rim, nosed left end, a web with an anvil window.
  const lowerRim = union(sector(PL, 115, 135, -134, -51, 96), sector(PL, noseR, 126, -155, -104, 96));
  const lowerWeb = P([...arc(PL, 116, -108, -51, 20), ...arc(PL, 100, -51, -50, 2), polar(PL, 40, -45), polar(PL, 40, -100)]);
  const lowerWindow = P([...arc(PL, 116.5, -98, -68, 16), polar(PL, 62, -80), polar(PL, 62, -92)]);
  lower.parts.quadrant = { planes: 'Y', poly: diff(union(lowerRim, lowerWeb), lowerWindow) };
  lower.parts.weightArm = { planes: 'W', poly: union(P([[256, 364], [150, 412], [155, 430], [292, 388]]), P(circlePoints([142, 421], 11, 48))) };
  lower.eye = [142, 421];
  // Upper quadrant with its back-weight arm and eye in one casting.
  const upperRim = union(sector(PU, 111, 135, -32, 40, 60), sector(PU, toeR, 128, 30, 66, 72));
  const upperWeb = P([polar(PU, 30, -40), ...arc(PU, 112, -32, 40, 20), polar(PU, 60, 44), polar(PU, 30, 45)]);
  const upperWindow = P([[318, 112], [340, 100], [372, 74], ...arc(PU, 110, -27, 36, 16).slice(1), [345, 178], [330, 160], [325, 140]]);
  const upperWeightArm = union(P([[292, 97], [378, 50], [392, 62], [312, 112]]), P(circlePoints([400, 43], 11, 48)));
  upper.parts.quadrant = { planes: 'X', poly: diff(union(upperRim, upperWeb, upperWeightArm), upperWindow) };
  upper.eye = [400, 43];
  return { upper, lower, noseR, toeR };
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
export function handleOverlap(body, angle, other, otherAngle, T) {
  let total = 0;
  const tappet = tappetPolygon(T);
  for (const part of Object.values(body.parts)) {
    const moved = transformPolygon(part.poly, body.pivot, angle * deg);
    if (shares(part.planes, 'AXYB')) total += overlapArea(moved, tappet);
    for (const otherPart of Object.values(other.parts)) {
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
  const resolve = (body, angle, other, otherAngle, T, step) => {
    const clear = (x) => handleOverlap(body, x, other, otherAngle, T) < 0.05;
    const tight = (x) => handleOverlap(body, x, other, otherAngle, T) < 0.005;
    if (!clear(angle)) {
      let lo = angle, hi = angle;
      for (let k = 1; k < 400; k++) { hi = angle - body.dir * k * 0.5; if (clear(hi)) break; }
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (tight(m)) hi = m; else lo = m; }
      return hi;
    }
    const target = body.dir > 0 ? Math.min(body.limits[1], angle + step) : Math.max(body.limits[0], angle - step);
    if (clear(target)) return target;
    let lo = angle, hi = target;
    if (!tight(lo)) return lo;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (tight(m)) lo = m; else hi = m; }
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
  return { samples, rows, noseR: parts.noseR, toeR: parts.toeR };
}
