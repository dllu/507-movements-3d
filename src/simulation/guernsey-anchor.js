// Movement 402, Guernsey's escapement: every working part as plain 2D
// geometry in the plate's plane (model units, y up, lever pivot B at the
// origin; plate pixels scale by 0.018).
//
// - Escape wheel: Brown's twelve saw teeth. Each tooth has a short front face
//   that leans back a little (its root lies ahead of its tip) and a long
//   straight back; tips and roots are small circular rounds. The wheel is
//   urged counter-clockwise.
// - Anchor A and lever B are one plate: a bored boss at B, a curved upper arm
//   to pallet A, a straight lower arm to the lower pallet, a straight bar to a
//   curved arm of two runs, each an annular band concentric with B, stepped
//   at the bar: the upper run carries the internal teeth that drive the upper
//   balance pinion, the lower run the external teeth that drive the left one.
// - Each pallet is a blade whose working flank lies exactly along a tooth's
//   front face, with its rounded nose in the root, at the end of the lever's
//   swing that drives it in (the upper pallet at -A, the lower at +A, half a
//   pitch of wheel apart). Withdrawal lets the tooth slide out along the
//   flank (impulse), the tooth drops onto the other pallet, which carries it
//   back into its own root (recoil).
// The wheel's motion is not prescribed: scripts/bake-guernsey-anchor-402.mjs
// drives it forward and stops it wherever the outlines meet
// (plate-escapement-kit.js solveDrivenWheel) and stores one period.
import polygonClipping from 'polygon-clipping';
import { involute } from './band-epicyclic-geometry.js';
import { solveDrivenWheel, placeFlat, toFlat } from './plate-escapement-kit.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const SOURCE_SCALE = 0.018;
// Raster centres measured on Brown's 525 px plate.
export const SOURCE_POINTS = Object.freeze({
  leverPivotB: [301, 330],
  escapeWheel: [378.6, 378.3],
  upperBalance: [261.7, 230],
  leftBalance: [159.3, 299.3],
});
export const toModel = ([x, y]) => [(x - SOURCE_POINTS.leverPivotB[0]) * SOURCE_SCALE, (SOURCE_POINTS.leverPivotB[1] - y) * SOURCE_SCALE];

export const DESIGN = Object.freeze({
  wheelCenter: toModel(SOURCE_POINTS.escapeWheel),
  upperCenter: toModel(SOURCE_POINTS.upperBalance),
  leftCenter: toModel(SOURCE_POINTS.leftBalance),
  teeth: 12,
  // Brown's tips lie 59-62 px from the arbor, his roots 47-49 px.
  tipRadius: 1.09,
  rootRadius: 0.85,
  // Angle by which each front-face root leads its tip.
  frontLean: 6 * DEG,
  // Brown's steep faces lie clockwise of their tips: the wheel turns
  // clockwise (-1).
  sense: -1,
  // The lower seat's wheel angle past the half pitch.
  lowerSeatShift: 0,
  tipRound: 0.018,
  rootRound: 0.03,
  // Lever (and anchor) swing either side of the plate pose.
  leverAmplitude: 10 * DEG,
  // Angle about the wheel of the root the upper pallet seats in at -A.
  upperSeatAngle: 114 * DEG,
  // Pallet blade: nose this far up the face from the root, flank running this
  // far past the tip, blade width at its outer end, nose round.
  palletSetback: 0.03,
  palletOverrun: 0.15,
  palletWidth: 0.13,
  palletChisel: 40 * DEG,
  palletNoseRound: 0.012,
  // Gearing: two equal twenty-tooth involute pinions (Brown draws 18-20
  // fine teeth), 30 degree pressure. With the 10 degree swing, thirteen teeth
  // on each run pass the pitch point.
  pinionTeeth: 20,
  module: 0.026,
  pressureAngle: 30 * DEG,
  addendum: 0.9,
  dedendum: 1.15,
  backlash: 0.002,
  // Plate thicknesses and plane.
  armWidth: 0.15,
  // Radial width of each toothed run of the curved arm.
  bandWidth: 0.16,
  bossRadius: 0.22,
  boreRadius: 0.075,
  period: 6,
  dropAcceleration: 24,
  stepsPerPeriod: 1600,
});

const polar = (c, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, s) => [a[0] * s, a[1] * s];
const unit = (a) => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; };
export const rotateAbout = ([x, y], angle, [cx, cy] = [0, 0]) => {
  const dx = x - cx, dy = y - cy, c = Math.cos(angle), s = Math.sin(angle);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};
const signedArea = (ring) => ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const ccw = (ring) => (signedArea(ring) < 0 ? [...ring].reverse() : ring);
const arc = (c, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => polar(c, r, a0 + (a1 - a0) * i / n));

// Replace corner b of the path a-b-c by a circular round of radius r.
function roundCorner(a, b, c, r, count = 8) {
  const u1 = unit(sub(a, b)), u2 = unit(sub(c, b));
  const cosine = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]));
  const half = Math.acos(cosine) / 2;
  if (half < 1e-6 || r <= 0) return [b];
  const t = r / Math.tan(half), bis = unit(add(u1, u2));
  const center = add(b, scale(bis, r / Math.sin(half)));
  const p1 = add(b, scale(u1, t)), p2 = add(b, scale(u2, t));
  let s = Math.atan2(p1[1] - center[1], p1[0] - center[0]);
  let e = Math.atan2(p2[1] - center[1], p2[0] - center[0]);
  let d = e - s; d = Math.atan2(Math.sin(d), Math.cos(d));
  return Array.from({ length: count + 1 }, (_, i) => polar(center, r, s + d * i / count));
}

export function roundPolygon(points, radii, count = 8) {
  const out = [];
  points.forEach((b, i) => {
    const a = points[(i - 1 + points.length) % points.length], c = points[(i + 1) % points.length];
    out.push(...roundCorner(a, b, c, radii[i], count));
  });
  return out;
}

// ---------------------------------------------------------------------------
// Escape wheel (wheel frame: centre at the origin, tooth k's tip at k * pitch).
export const pitch = () => TAU / DESIGN.teeth;

export function toothCorners(k) {
  const p = pitch(), f = DESIGN.frontLean, s = DESIGN.sense;
  return {
    tip: polar([0, 0], DESIGN.tipRadius, k * p),
    frontRoot: polar([0, 0], DESIGN.rootRadius, k * p + s * f),
  };
}

// Closed counter-clockwise outline: back of tooth k rising to its tip, front
// face falling to its root, which starts the back of tooth k + 1.
export function wheelOutline() {
  const corners = [], radii = [];
  for (let k = 0; k < DESIGN.teeth; k += 1) {
    const t = toothCorners(k);
    if (DESIGN.sense > 0) { corners.push(t.tip, t.frontRoot); radii.push(DESIGN.tipRound, DESIGN.rootRound); }
    else { corners.push(t.frontRoot, t.tip); radii.push(DESIGN.rootRound, DESIGN.tipRound); }
  }
  return roundPolygon(corners, radii, 8);
}

// Collision cells: tooth k from mid-root to mid-root, closed well inside the
// root circle (the web between cells never reaches a pallet).
export function wheelCells(outline = wheelOutline()) {
  const p = pitch(), f = DESIGN.frontLean, inner = DESIGN.rootRadius - 0.2;
  const angleOf = (q) => Math.atan2(q[1], q[0]);
  return Array.from({ length: DESIGN.teeth }, (_, k) => {
    const lo = DESIGN.sense > 0 ? (k - 1) * p + f : k * p - f, hi = lo + p;
    const inside = (q) => {
      let d = angleOf(q) - lo; d = ((d % TAU) + TAU) % TAU;
      return d <= hi - lo + 1e-12;
    };
    // Walk the outline from the first point inside the window.
    const n = outline.length;
    let start = outline.findIndex((q, i) => inside(q) && !inside(outline[(i - 1 + n) % n]));
    const points = [];
    for (let i = 0; i < n; i += 1) { const q = outline[(start + i) % n]; if (!inside(q)) break; points.push(q); }
    points.push(polar([0, 0], inner, hi), polar([0, 0], inner, lo));
    return { points, angle: k * p };
  });
}

// ---------------------------------------------------------------------------
// Lever / anchor (lever frame = the plate pose; the lever turns by theta
// about the origin).
export const leverAngleAt = (time) => DESIGN.leverAmplitude * Math.sin(TAU * time / DESIGN.period);

// Blade seated on tooth `k` of a wheel turned to `wheelAngle`, placed in
// world coordinates; returned in the lever frame for lever angle `lever`.
function seatedPallet(wheelAngle, k, lever) {
  const O = DESIGN.wheelCenter;
  const t = toothCorners(k);
  const tip = add(O, rotateAbout(t.tip, wheelAngle)), root = add(O, rotateAbout(t.frontRoot, wheelAngle));
  const d = unit(sub(tip, root)), faceLength = Math.hypot(...sub(tip, root));
  // Normal pointing away from the tooth, towards the counter-clockwise side.
  const radial = unit(sub(root, O));
  let n = [-d[1], d[0]];
  const ahead = scale([-radial[1], radial[0]], DESIGN.sense);
  if (n[0] * ahead[0] + n[1] * ahead[1] < 0) n = scale(n, -1);
  // Chisel nose: the back flank leaves the nose at palletChisel to the
  // working flank until the blade is palletWidth wide, then runs parallel.
  const nose = add(root, scale(d, DESIGN.palletSetback));
  const heel = add(root, scale(d, faceLength + DESIGN.palletOverrun));
  const chiselLength = DESIGN.palletWidth / Math.tan(DESIGN.palletChisel);
  const shoulder = add(add(nose, scale(d, chiselLength)), scale(n, DESIGN.palletWidth));
  const back = add(heel, scale(n, DESIGN.palletWidth));
  const world = [nose, heel, back, shoulder];
  const local = world.map((q) => rotateAbout(q, -lever));
  return {
    nose: local[0], heel: local[1], back: local[2], shoulder: local[3],
    flank: [local[0], local[1]],
    outline: ccw(roundPolygon(local, [DESIGN.palletNoseRound, 0, 0, 0.04], 10)),
  };
}

export function seats() {
  const A = DESIGN.leverAmplitude, p = pitch(), f = DESIGN.frontLean;
  // Upper pallet: at -A its root is at upperSeatAngle about the wheel.
  const s = DESIGN.sense, upperWheel = DESIGN.upperSeatAngle - s * f;
  // Lower pallet: at +A, half a pitch of wheel later, on the tooth whose
  // root then lies 2.5 pitches round from the upper seat.
  const lowerWheel = upperWheel + s * (p / 2 + DESIGN.lowerSeatShift);
  return {
    upperWheel, lowerWheel,
    upper: seatedPallet(upperWheel, 0, -A),
    lower: seatedPallet(lowerWheel, s > 0 ? 2 : 3, A),
  };
}

// Involute gearing about the lever: internal teeth on the band's inner edge
// mesh the upper pinion, external teeth on its outer edge the left pinion.
export function gearing() {
  const m = DESIGN.module, rp = DESIGN.pinionTeeth * m / 2;
  const dUpper = Math.hypot(...DESIGN.upperCenter), dLeft = Math.hypot(...DESIGN.leftCenter);
  const internalRadius = dUpper + rp, externalRadius = dLeft - rp;
  const ha = DESIGN.addendum * m, hf = DESIGN.dedendum * m;
  return {
    m, rp, ha, hf, dUpper, dLeft, internalRadius, externalRadius,
    upperAngle: Math.atan2(DESIGN.upperCenter[1], DESIGN.upperCenter[0]),
    leftAngle: Math.atan2(DESIGN.leftCenter[1], DESIGN.leftCenter[0]),
    // The upper run's plain back stands outside its internal teeth; the lower
    // run's plain back inside its external teeth. The two runs are each
    // concentric with B and meet with a step at the bar, as Brown draws.
    bandInner: internalRadius + hf, bandOuter: externalRadius - hf,
    upperBand: [internalRadius + hf, internalRadius + hf + DESIGN.bandWidth],
    lowerBand: [externalRadius - hf - DESIGN.bandWidth, externalRadius - hf],
    // Pinion angle per lever angle (internal: same sense; external: opposite).
    upperRatio: internalRadius / rp, leftRatio: -externalRadius / rp,
  };
}

// One rack tooth (internal or external) centred on angle 0 at pitch radius R,
// as a closed outline running from root to tip and back, sunk `sink` into
// the band so it unions cleanly.
function rackTooth(R, internal, sink) {
  const { m, ha, hf } = gearing(), alpha = DESIGN.pressureAngle, base = R * Math.cos(alpha);
  const angularPitch = Math.PI * m / R;
  const half = (r) => angularPitch / 4 - DESIGN.backlash / (2 * R)
    + (internal ? 1 : -1) * (involute(r / base) - involute(1 / Math.cos(alpha)));
  const root = R + (internal ? 1 : -1) * hf, tip = R + (internal ? -1 : 1) * ha;
  const buried = root + (internal ? 1 : -1) * sink;
  const pts = [], P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  pts.push(P(buried, -half(root)));
  for (let i = 0; i <= 10; i += 1) { const r = root + (tip - root) * i / 10; pts.push(P(r, -half(r))); }
  for (let i = 1; i < 3; i += 1) pts.push(P(tip, -half(tip) + 2 * half(tip) * i / 3));
  for (let i = 10; i >= 0; i -= 1) { const r = root + (tip - root) * i / 10; pts.push(P(r, half(r))); }
  pts.push(P(buried, half(root)));
  return ccw(pts);
}

export function rackLayout() {
  const g = gearing(), A = DESIGN.leverAmplitude;
  // Teeth whose centres pass within 1.5 pitches of the pitch point.
  const layout = (R, center, margin) => {
    const beta = Math.PI * g.m / R, reach = A + margin * beta;
    const n = Math.floor(reach / beta);
    return Array.from({ length: 2 * n + 1 }, (_, i) => center + (i - n) * beta);
  };
  return {
    internal: layout(g.internalRadius, g.upperAngle, 1.5),
    external: layout(g.externalRadius, g.leftAngle, 1.5),
  };
}

// Stroke of constant half-width along an open polyline, with round ends.
export function stroke(path, halfWidth, capSegments = 12) {
  const left = [], right = [];
  path.forEach((q, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const d = unit(sub(b, a)), n = [-d[1], d[0]];
    left.push(add(q, scale(n, halfWidth))); right.push(add(q, scale(n, -halfWidth)));
  });
  const d0 = unit(sub(path[1], path[0])), d1 = unit(sub(path.at(-1), path.at(-2)));
  const a0 = Math.atan2(d0[1], d0[0]), a1 = Math.atan2(d1[1], d1[0]);
  const endCap = arc(path.at(-1), halfWidth, a1 + Math.PI / 2, a1 - Math.PI / 2, capSegments).slice(1, -1);
  const startCap = arc(path[0], halfWidth, a0 - Math.PI / 2, a0 - 3 * Math.PI / 2, capSegments).slice(1, -1);
  return ccw([...left, ...endCap, ...right.reverse(), ...startCap]);
}

const quadratic = (a, c, b, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
});
const closeRing = (ring) => [...ring, ring[0]];
const asPolygon = (ring) => [[closeRing(ring)]];

// Lever B with anchor A: one outline (plus the bore) in the lever frame.
export function leverOutline() {
  const g = gearing(), s = seats(), A = DESIGN.leverAmplitude, w = DESIGN.armWidth / 2;
  const racks = rackLayout();
  const barAngle = 151.8 * DEG;
  // Two runs, each an annular band concentric with B, overlapping under the
  // bar: the upper carries the internal teeth, the lower the external.
  const bands = (() => {
    const beta = (R) => Math.PI * g.m / R;
    const start = racks.internal[0] - 1.2 * beta(g.internalRadius);
    const end = racks.external.at(-1) + 1.2 * beta(g.externalRadius);
    const lap = 0.03;
    const [ui, uo] = g.upperBand, [li, lo] = g.lowerBand;
    return [
      ccw([...arc([0, 0], uo, start, barAngle + lap, 120), ...arc([0, 0], ui, barAngle + lap, start, 120)]),
      ccw([...arc([0, 0], lo, barAngle - lap, end, 80), ...arc([0, 0], li, end, barAngle - lap, 80)]),
    ];
  })();
  const parts = bands.map(asPolygon);
  for (const center of racks.internal) parts.push(asPolygon(rackTooth(g.internalRadius, true, 0.01).map((q) => rotateAbout(q, center))));
  for (const center of racks.external) parts.push(asPolygon(rackTooth(g.externalRadius, false, 0.01).map((q) => rotateAbout(q, center))));
  // Bar from the boss to the band's middle, along Brown's line of B.
  parts.push(asPolygon(stroke([[0, 0], polar([0, 0], (g.upperBand[0] + g.lowerBand[0]) / 2, barAngle)], 0.085)));
  parts.push(asPolygon(arc([0, 0], DESIGN.bossRadius, 0, TAU, 96).slice(0, -1)));
  // Upper arm: rises from the boss and arches over to pallet A's heel.
  const upperEnd = scale(add(s.upper.heel, s.upper.back), 0.5);
  const upperPath = quadratic([0.08, 0.05], [0.18, 0.62], upperEnd, 32);
  parts.push(asPolygon(stroke(upperPath, w)));
  parts.push(asPolygon(s.upper.outline));
  // Lower arm: down from the boss, bowed a little to the left as Brown
  // draws it, to the lower pallet's heel.
  const lowerEnd = scale(add(s.lower.heel, s.lower.back), 0.5);
  const lowerPath = quadratic([0, -0.05], [-0.12, -0.5], lowerEnd, 24);
  parts.push(asPolygon(stroke(lowerPath, w)));
  parts.push(asPolygon(s.lower.outline));
  const union = polygonClipping.union(...parts);
  if (union.length !== 1 || union[0].length !== 1) throw new Error(`402 lever outline is not one simply connected plate (${union.length} pieces)`);
  const outer = union[0][0].slice(0, -1);
  const bore = arc([0, 0], DESIGN.boreRadius, TAU, 0, 64).slice(0, -1);
  return { outer, holes: [bore], upperArmPath: upperPath, lowerArmPath: lowerPath, barAngle };
}

// Obstacles the wheel meets: the two pallet blades, lever frame.
export function palletObstacles() {
  const s = seats();
  return [s.upper.outline, s.lower.outline];
}

// Drive the wheel against the swinging pallets for one period.
export function solveWheel({ stepsPerPeriod = DESIGN.stepsPerPeriod, debug = false } = {}) {
  const cells = wheelCells();
  const pallets = palletObstacles().map(toFlat);
  const s = seats();
  const solution = solveDrivenWheel({
    wheel: { center: DESIGN.wheelCenter, count: DESIGN.teeth, parts: cells },
    obstacles: (t) => pallets.map((flat) => ({ points: placeFlat(flat, { x: 0, y: 0, angle: leverAngleAt(t) }) })),
    period: DESIGN.period,
    stepsPerPeriod,
    direction: DESIGN.sense,
    dropAcceleration: DESIGN.dropAcceleration,
    initialAngle: DESIGN.sense * s.upperWheel - pitch() * 0.2,
    maxUnresolved: debug ? Infinity : 20,
    startTime: 0,
  });
  return solution;
}
