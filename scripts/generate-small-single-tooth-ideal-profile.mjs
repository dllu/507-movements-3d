// p101: regenerate 069's wheel A with ideal, rotationally symmetric teeth.
// Each of the thirty teeth is two straight flanks (Brown's long sloping back
// and short steep face, the root at 0.62 of the pitch as read from the plate)
// joined by a root fillet and a small round tip. B (driver outline, rim lock
// and single tooth) is unchanged. The tip radius sets the lock: the tips are
// sized so B's plain rim seats between two tips with the same small play as
// before. The motion is re-solved with the same first-allowed-configuration
// quasistatic method as the source study.
//   node scripts/generate-small-single-tooth-ideal-profile.mjs [--write]
import { writeFile } from 'node:fs/promises';
import current from '../src/data/small-single-tooth-index-profile.js';
import { makeSmallSingleToothConstraintField } from './lib/small-single-tooth-constraint-field.mjs';

const write = process.argv.includes('--write');
const base = current.parameters, teeth = 30, pitch = 2 * Math.PI / teeth;
const tipRadius = Number(process.env.TIP ?? 0.035), rootFillet = Number(process.env.FILLET ?? 0.07), rootFraction = Number(process.env.RF ?? 0.62), rootRadius = Number(process.env.RR ?? 2.2416);
const samplesPerTooth = 256;

// Fillet a closed polygon's corners with circular arcs; returns a dense ring.
function filleted(vertices, radii, arcSteps = 48) {
  const out = [], n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p = vertices[i], a = vertices[(i + n - 1) % n], b = vertices[(i + 1) % n], r = radii[i];
    const u = norm([a[0] - p[0], a[1] - p[1]]), v = norm([b[0] - p[0], b[1] - p[1]]);
    const half = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / 2;
    const t = r / Math.tan(half), bis = norm([u[0] + v[0], u[1] + v[1]]), d = r / Math.sin(half);
    const c = [p[0] + bis[0] * d, p[1] + bis[1] * d];
    const s = [p[0] + u[0] * t, p[1] + u[1] * t], e = [p[0] + v[0] * t, p[1] + v[1] * t];
    let a0 = Math.atan2(s[1] - c[1], s[0] - c[0]), a1 = Math.atan2(e[1] - c[1], e[0] - c[0]);
    const cross = u[0] * v[1] - u[1] * v[0];
    // Sweep the short way round the fillet centre.
    let sweep = a1 - a0; while (sweep > Math.PI) sweep -= 2 * Math.PI; while (sweep < -Math.PI) sweep += 2 * Math.PI;
    for (let k = 0; k <= arcSteps; k++) out.push([c[0] + r * Math.cos(a0 + sweep * k / arcSteps), c[1] + r * Math.sin(a0 + sweep * k / arcSteps)]);
    void cross;
  }
  return out;
}
function norm(v) { const l = Math.hypot(...v); return [v[0] / l, v[1] / l]; }

function resample(ring, count, startIndex) {
  const pts = [...ring.slice(startIndex), ...ring.slice(0, startIndex)], lengths = [0];
  for (let i = 1; i <= pts.length; i++) lengths.push(lengths.at(-1) + Math.hypot(pts[i % pts.length][0] - pts[i - 1][0], pts[i % pts.length][1] - pts[i - 1][1]));
  const total = lengths.at(-1), out = []; let j = 0;
  for (let k = 0; k < count; k++) {
    const s = total * k / count; while (lengths[j + 1] < s) j++;
    const f = (s - lengths[j]) / (lengths[j + 1] - lengths[j]), a = pts[j], b = pts[(j + 1) % pts.length];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

function wheel(tipCornerRadius) {
  const vertices = [], radii = [];
  for (let k = 0; k < teeth; k++) {
    const t = k * pitch, r = (k + rootFraction) * pitch;
    vertices.push([tipCornerRadius * Math.cos(t), tipCornerRadius * Math.sin(t)]); radii.push(tipRadius);
    vertices.push([rootRadius * Math.cos(r), rootRadius * Math.sin(r)]); radii.push(rootFillet);
  }
  // One tooth's worth of fillet points per corner pair; start the ring at the
  // outermost point of the first tip so every tooth starts at its crest.
  const dense = filleted(vertices, radii);
  let start = 0; for (let i = 0; i < 49; i++) if (Math.hypot(...dense[i]) > Math.hypot(...dense[start])) start = i;
  const ring = resample(dense, teeth * samplesPerTooth, start);
  // Enforce exact rotational symmetry from the first tooth.
  const first = ring.slice(0, samplesPerTooth), out = [];
  for (let k = 0; k < teeth; k++) {
    const c = Math.cos(k * pitch), s = Math.sin(k * pitch);
    for (const [x, y] of first) out.push([x * c - y * s, x * s + y * c]);
  }
  return out;
}

// B's plain rim seats between two rounded tips. The tip corner radius is
// chosen so the seat keeps the traced model's small angular play (0.0002).
const lockOf = corner => {
  const trial = { driver: current.driver, output: [wheel(corner)], parameters: { ...base } };
  const f = makeSmallSingleToothConstraintField(trial, base).atAngle(0);
  // Minimum penetration over advance near the drawn seat.
  let best = 0, bestDepth = Infinity;
  for (let d = -0.004; d <= 0.004; d += 0.00005) { const v = f(d); if (v < bestDepth) { bestDepth = v; best = d; } }
  if (bestDepth > 1e-9) return { trial, play: -bestDepth, f, best };
  const edge = (inside, outside) => { for (let i = 0; i < 70; i++) { const m = (inside + outside) / 2; if (f(m) <= 1e-9) inside = m; else outside = m; } return inside; };
  const upper = edge(best, best + 0.05), lower = edge(best, best - 0.05);
  return { trial, play: upper - lower, upper, lower, f };
};
let lo = base.outputRadius - 0.05, hi = base.outputRadius + 0.1;
for (let i = 0; i < 40; i++) {
  const mid = (lo + hi) / 2, { play } = lockOf(mid);
  if (play > 0.0002) lo = mid; else hi = mid;
}
const lock = lockOf(lo), output = lock.trial.output[0];
const profile = { driver: current.driver, output: [output], parameters: { ...base, outputRadius: Math.max(...output.map(q => Math.hypot(...q))) } };
// The rim is a 4096-gon, so as B turns its facets move by up to 2e-7; the
// dwell pose stands 1e-5 inside the positive seat edge.
const seatMargin = 1e-5;
const positiveSeat = base.initialQ - lock.upper + seatMargin, negativeSeat = base.initialQ - lock.lower;
const fullAngularPlay = lock.upper - lock.lower;
console.log({ tipCorner: lo, crest: profile.parameters.outputRadius, positiveSeat, negativeSeat, fullAngularPlay });

// Re-solve the indexing stroke from the positive seat.
const p = { ...profile.parameters, initialQ: positiveSeat, positiveSeat, negativeSeat, fullAngularPlay };
profile.parameters = p;
// The stroke leaves A wherever B's tooth releases it inside the rim lock's
// play; the dwell pose is moved to that release pose (iterated) so each turn
// closes exactly two pitches.
let field, rows, advance, failed;
const tolerance = 1e-7, phaseSteps = 5200, begin = 2, end = 4.6, step = (end - begin) / phaseSteps;
const solve = () => {
  field = makeSmallSingleToothConstraintField(profile, p); rows = []; advance = 0; failed = [];
  for (let i = 0; i <= phaseSteps; i++) {
    const angle = begin + i * step, intrusion = field.atAngle(angle);
    if (intrusion(advance) > tolerance) {
      const firstAllowed = (l, h) => {
        const mid = (l + h) / 2, depth = intrusion(mid);
        if (depth - field.lipschitzBound * (h - l) / 2 > tolerance) return null;
        if (h - l < 1e-10) { for (const at of [l, mid, h]) if (intrusion(at) <= tolerance) return at; return null; }
        return firstAllowed(l, mid) ?? firstAllowed(mid, h);
      };
      const permitted = firstAllowed(advance, 2 * pitch + 0.02);
      if (permitted === null || permitted - advance > 0.03) { failed.push({ i, angle, advance, permitted }); break; }
      advance = permitted;
    }
    rows.push([angle, advance]);
  }
  if (failed.length) { const f = failed[0]; console.log('FAILED', failed, field.atAngle(f.angle)(f.advance, true)); process.exit(1); }
};
for (let iteration = 0; iteration < 6; iteration++) {
  solve();
  const miss = advance - 2 * pitch;
  console.log('iteration', iteration, 'initialQ', p.initialQ, 'miss', miss);
  if (Math.abs(miss) < 1e-9) break;
  p.initialQ = p.initialQ - miss;
  if (p.initialQ < Math.min(p.positiveSeat, p.negativeSeat) - 1e-12 || p.initialQ > Math.max(p.positiveSeat, p.negativeSeat) + 1e-12) throw new Error('Dwell pose left the rim lock');
}
console.log('final advance', advance, 'two pitches', 2 * pitch, 'difference', advance - 2 * pitch);
// Entry knots after each dwell (as in the source study): the exact input
// angle at which contact first requires motion.
const knots = [];
for (let i = 1; i < rows.length; i++) {
  if (rows[i][1] > rows[i - 1][1] + 1e-7 && (i < 2 || rows[i - 1][1] === rows[i - 2][1])) {
    const held = rows[i - 1][1]; let l = rows[i - 1][0], h = rows[i][0];
    for (let k = 0; k < 50; k++) { const m = (l + h) / 2; if (field.atAngle(m)(held) > 1e-7) h = m; else l = m; }
    knots.push([(l + h) / 2, held]);
  }
}
const motion = [...rows, ...knots].sort((a, b) => a[0] - b[0]);
// Snap the finished stroke to exactly two pitches: the rim then re-seats A.
if (Math.abs(advance - 2 * pitch) > 1e-9) throw new Error('Stroke does not close two pitches');
// The stroke ends at the last sample where A moves appreciably (> 1e-7);
// the remaining sub-tolerance creep is folded into the snap.
let exitIndex = 1; for (let i = 1; i < motion.length; i++) if (motion[i][1] - motion[i - 1][1] > 1e-7) exitIndex = i;
for (let i = exitIndex; i < motion.length; i++) motion[i] = [motion[i][0], 2 * pitch];
const exitAngle = motion[exitIndex][0];
let peak = 0; for (let i = 1; i < motion.length; i++) peak = Math.max(peak, (motion[i][1] - motion[i - 1][1]) / (motion[i][0] - motion[i - 1][0] || Infinity));
const pauses = []; for (let i = 1; i < knots.length; i++) pauses.push(knots[i][0]);
Object.assign(p, { entryAngle: knots[0][0], exitAngle, cycleClosureError: 0, toothTipRadius: tipRadius, toothRootFillet: rootFillet,
  toothRootFraction: rootFraction, toothRootRadius: rootRadius, idealTeeth: true });
profile.motion = motion;
console.log({ entryAngle: p.entryAngle, exitAngle, peak, knots: knots.map(k => k[0]), rows: motion.length });
if (write) {
  await writeFile('src/data/small-single-tooth-index-profile.js',
    '// p101: ideal symmetric teeth on A (straight flanks, root fillet, round tip); B unchanged; motion re-solved\n// by scripts/generate-small-single-tooth-ideal-profile.mjs.\nexport default '
    + JSON.stringify(profile) + ';\n');
  console.log('wrote src/data/small-single-tooth-index-profile.js');
}
