// Movement 238: Brown's six-point star wheel D and the one-piece anchor that
// carries pallets B and C, pivoted at A.
//
// Everything here is plain 2D geometry in the plate's plane (model units, D at
// the origin, y up). The anchor outline is Brown's traced outline with two
// working edges set from the star itself:
// - B, the step on the anchor's left, is a flat face lying along tooth 0's
//   leading flank in the plate pose; its corner sits in the root between the
//   lower-left and bottom points, as Brown draws it.
// - C, the hooked end of the upper arm, has its lower edge along tooth 2's
//   leading flank when the anchor has swung fully the other way (wheel half a
//   pitch on); its point nests in the next root.
// The wheel's motion is not prescribed. The anchor swings sinusoidally (the
// pendulum), the wheel is urged counter-clockwise with constant acceleration
// and stops wherever the star first meets the anchor; a pallet entering a
// root pushes the wheel back (recoil). scripts/bake-six-point-anchor-238.mjs
// runs this contact search offline and stores one cycle of wheel angle.

export const SOURCE_SCALE = 0.0165;
export const SOURCE_D = [214, 210];
const toModel = ([x, y]) => [(x - SOURCE_D[0]) * SOURCE_SCALE, (SOURCE_D[1] - y) * SOURCE_SCALE];
const toSource = ([x, y]) => [x / SOURCE_SCALE + SOURCE_D[0], SOURCE_D[1] - y / SOURCE_SCALE];

export const DESIGN = Object.freeze({
  teeth: 6,
  // Tip radius: the lower-left point touches B at raster (170, 253).
  tipRadius: Math.hypot(...toModel([170, 253])),
  // Brown's roots lie 38-44 px from D against 60-68 px tips.
  rootRadius: 0.64,
  // Small round on each point so no tip is a knife edge.
  tipRound: 0.03,
  // B's corner and C's point stop this far up the flank from the root.
  palletRootSetback: 0.06,
  // Total swing of the anchor (degrees). With it, C's point in the plate pose
  // lands 3 px from Brown's (290, 185).
  swingDegrees: 14,
  pivotA: toModel([264, 354]),
  mountPhase: Math.atan2(toModel([170, 253])[1], toModel([170, 253])[0]),
  // Constant urging acceleration of the free wheel, rad per cycle^2.
  wheelAcceleration: 60,
});

const pitch = () => 2 * Math.PI / DESIGN.teeth;
export const rotate = ([x, y], angle, [cx, cy] = [0, 0]) => {
  const dx = x - cx, dy = y - cy, c = Math.cos(angle), s = Math.sin(angle);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};

// Point where the line from v touches the circle (c, r); side +1/-1.
function tangentPoint(v, c, r, side) {
  const dx = c[0] - v[0], dy = c[1] - v[1], d = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) + side * Math.asin(r / d), length = Math.sqrt(d * d - r * r);
  return [v[0] + length * Math.cos(angle), v[1] + length * Math.sin(angle)];
}

// Angle of q about the origin measured from direction a, in (-pi, pi].
const relativeAngle = (q, a) => Math.atan2(q[1] * Math.cos(a) - q[0] * Math.sin(a), q[0] * Math.cos(a) + q[1] * Math.sin(a));

// One tooth's geometry: tip arc and the tangent points of both flanks.
export function toothGeometry(k) {
  const {tipRadius: R, rootRadius: r, tipRound: rt, mountPhase} = DESIGN, a = mountPhase + k * pitch();
  const center = [(R - rt) * Math.cos(a), (R - rt) * Math.sin(a)];
  const trailingRoot = [r * Math.cos(a - pitch() / 2), r * Math.sin(a - pitch() / 2)];
  const leadingRoot = [r * Math.cos(a + pitch() / 2), r * Math.sin(a + pitch() / 2)];
  const pick = (v, sign) => [tangentPoint(v, center, rt, 1), tangentPoint(v, center, rt, -1)]
    .sort((p, q) => sign * (relativeAngle(p, a) - relativeAngle(q, a)))[0];
  return {angle: a, center, trailingRoot, leadingRoot, trailingTangent: pick(trailingRoot, 1), leadingTangent: pick(leadingRoot, -1)};
}

// Closed star outline (counter-clockwise), wheel frame.
export function starOutline(arcSegments = 8) {
  const points = [];
  for (let k = 0; k < DESIGN.teeth; k++) {
    const t = toothGeometry(k);
    let a1 = Math.atan2(t.trailingTangent[1] - t.center[1], t.trailingTangent[0] - t.center[0]);
    let a2 = Math.atan2(t.leadingTangent[1] - t.center[1], t.leadingTangent[0] - t.center[0]);
    while (a2 < a1) a2 += 2 * Math.PI;
    for (let i = 0; i <= arcSegments; i++) {
      const u = a1 + (a2 - a1) * i / arcSegments;
      points.push([t.center[0] + DESIGN.tipRound * Math.cos(u), t.center[1] + DESIGN.tipRound * Math.sin(u)]);
    }
    points.push(t.leadingRoot);
  }
  return points;
}

// Working edge along tooth k's leading flank (wheel turned by wheelAngle),
// ending setback short of the root: [pointAtTip, corner].
function flankEdge(k, wheelAngle) {
  const t = toothGeometry(k), root = t.leadingRoot, tip = t.leadingTangent;
  const d = [root[0] - tip[0], root[1] - tip[1]], length = Math.hypot(...d), u = [d[0] / length, d[1] / length];
  const corner = [root[0] - u[0] * DESIGN.palletRootSetback, root[1] - u[1] * DESIGN.palletRootSetback];
  return {tip: rotate(tip, wheelAngle), corner: rotate(corner, wheelAngle), direction: rotate(u, wheelAngle)};
}

const quadratic = (a, c, b, n) => Array.from({length: n}, (_, i) => {
  const t = (i + 1) / n;
  return [0, 1].map(j => (1 - t) ** 2 * a[j] + 2 * t * (1 - t) * c[j] + t * t * b[j]);
});

// Anchor outline in the plate pose (world coordinates; the carrier turns it
// about A). Counter-clockwise. Returns the outline and the working edges.
export function anchorOutline(segments = 16) {
  const swing = DESIGN.swingDegrees * Math.PI / 180;
  const B = flankEdge(0, 0);
  // B's face runs out along the flank to Brown's outer corner (x of 158 px).
  const outer = toModel([158, 255]), s = (outer[0] - B.tip[0]) / B.direction[0];
  const bOuter = [B.tip[0] + B.direction[0] * s, B.tip[1] + B.direction[1] * s];
  // C: tooth 2 at the C lock (wheel half a pitch on, anchor swung by swing),
  // mapped back to the plate pose.
  const Cw = flankEdge(2, pitch() / 2), back = p => rotate(p, -swing, DESIGN.pivotA);
  const cExtent = 0.55;
  const cFar = [Cw.tip[0] - Cw.direction[0] * cExtent, Cw.tip[1] - Cw.direction[1] * cExtent];
  const cPoint = back(Cw.corner), cLower = back(cFar);
  const src = [], at = p => src.push(p);
  let current = [331, 161];
  at(toModel(current));
  const curve = (control, end) => {
    for (const p of quadratic(current, control, end, segments)) at(toModel(p));
    current = end;
  };
  // Brown's outer contour from C's upper edge round the heel to B.
  curve([383, 184], [403, 229]); curve([411, 265], [382, 309]); curve([346, 365], [282, 417]);
  curve([244, 441], [207, 420]); curve([173, 397], [171, 340]); curve([168, 287], toSource(bOuter));
  at(B.corner);
  current = toSource(B.corner);
  // Inner edge falls from B's corner and runs round the mouth to C.
  curve([215, 275], [242, 279]); curve([321, 284], [350, 263]); curve([374, 238], toSource(cLower));
  at(cPoint);
  // The outline is traced clockwise on screen (y down), i.e. counter-clockwise
  // here only after the flip; normalise to counter-clockwise.
  let area = 0;
  for (let i = 0; i < src.length; i++) { const p = src[i], q = src[(i + 1) % src.length]; area += p[0] * q[1] - q[0] * p[1]; }
  const outline = area < 0 ? src.reverse() : src;
  return {
    outline,
    B: {outer: bOuter, corner: B.corner, direction: B.direction},
    C: {lower: cLower, point: cPoint, direction: rotate(Cw.direction, -swing)},
    swing,
  };
}

const inside = (p, polygon) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
};

// True when the star (turned by wheelAngle) and the anchor (turned by
// palletAngle about A) overlap: a vertex of either inside the other.
export function makeOverlapTest(star = starOutline(), anchor = anchorOutline().outline) {
  const R = DESIGN.tipRadius, r = DESIGN.rootRadius;
  const near = anchor.filter(p => Math.hypot(...p) < R + 0.5);
  return (wheelAngle, palletAngle) => {
    const a = anchor.map(p => rotate(p, palletAngle, DESIGN.pivotA)), s = star.map(p => rotate(p, wheelAngle));
    for (const p of near) { const q = rotate(p, palletAngle, DESIGN.pivotA); if (Math.hypot(...q) < R + 0.01 && inside(q, s)) return true; }
    for (const p of s) if (Math.hypot(...p) > r - 0.01 && inside(p, a)) return true;
    return false;
  };
}

// Pallet angle (carrier rotation about A, counter-clockwise = B out) at a
// cycle phase; phase 0 is the plate pose, B fully in.
export const palletAngleAt = phase => DESIGN.swingDegrees * Math.PI / 180 * (1 - Math.cos(2 * Math.PI * phase)) / 2;

// Contact search: returns one cycle of wheel angles (steps samples, phase
// i/steps), starting at the B lock with 0 at the plate pose.
export function simulateWheel(steps = 1200, cycles = 3) {
  const overlaps = makeOverlapTest(), dt = 1 / steps;
  let w = -0.005, v = 0, table = [];
  for (let cycle = 0; cycle < cycles; cycle++) for (let i = 0; i < steps; i++) {
    if (cycle === cycles - 1) table.push(w);
    const p = palletAngleAt((i + 1) * dt);
    v += DESIGN.wheelAcceleration * dt;
    let next = w + v * dt;
    if (overlaps(next, p)) {
      let lo, hi;
      if (!overlaps(w, p)) { lo = w; hi = next; } else {
        // The pallet has moved into the tooth: push the wheel back.
        lo = w - 0.01; hi = w;
        while (overlaps(lo, p)) { hi = lo; lo -= 0.01; if (lo < w - 0.4) throw new Error('238 anchor jams the wheel'); }
      }
      for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (overlaps(m, p)) hi = m; else lo = m; }
      next = lo; v = Math.max(0, (next - w) / dt);
    }
    w = next;
  }
  const base = table[0];
  return {steps, closure: w - base, table: table.map(x => x - base), base};
}
