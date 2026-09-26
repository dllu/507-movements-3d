// Regenerates src/data/single-tooth-index-profile.js (movement 068) with the
// traced tooth A given Brown's rounded tip. The traced driver outline from
// scripts/lib/single-tooth-source-driver.mjs is opened (eroded then dilated)
// by a disc of radius TIP_RADIUS inside a small region round the tooth tip,
// which rounds the sharp apex without touching the notches, rim or recesses.
// The output wheel, the forward-only quasistatic contact projection and the
// entry-event bisection repeat the accepted pipeline
// (study-single-tooth-constrained-motion, generate-single-tooth-trimmed-
// profile, resolve-single-tooth-entry-event) for the new driver.
//
// Usage: node scripts/generate-single-tooth-rounded-profile.mjs [--tip-radius=0.04] [--out=file] [--check]
//   --check compares against the current data file instead of writing it.
import { readFile, writeFile } from 'node:fs/promises';
import clipping from 'polygon-clipping';
import { makeSingleToothSourceDriver } from './lib/single-tooth-source-driver.mjs';
import { makeSingleToothStarSolid } from './lib/single-tooth-star-solid.mjs';
import { makeSingleToothConstraintField } from './lib/single-tooth-constraint-field.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const hit = args.find(arg => arg.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const tipRadius = option('tip-radius', 0.04), check = args.includes('--check');
const target = args.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'src/data/single-tooth-index-profile.js';

const turn = 2 * Math.PI, n = 10, pitch = turn / n, half = pitch / 2;
const D = 2.72, R = 1.36, Rout = 1.417, slotRadius = 0.12, slotCenter = 1.337, clearance = 0.00015;
const upperReliefExtension = 0.08, clipReliefToRim = true, upperReliefMode = 'distributed', phaseSteps = 6400;
const traced = makeSingleToothSourceDriver({ circleSteps: 4096, curveSteps: 128, upperReliefExtension,
  clipReliefToRim, upperReliefMode })[0];

const circle = (x, y, r, count = 256) => [Array.from({ length: count }, (_, i) =>
  [x + r * Math.cos(turn * i / count), y + r * Math.sin(turn * i / count)])];

// Round only the tooth tip with a fillet of radius tipRadius: walking out
// from the apex along each flank, the first boundary point whose inward disc
// of that radius fits wholly inside the plate is where the fillet meets the
// flank. The apex between the two meeting points is replaced by a circular
// arc about their (coincident) disc centres. Everything a disc of that
// radius can reach, including both driving flanks, keeps its traced form.
function roundTip(ring, radius) {
  if (!(radius > 0)) return ring;
  const count = ring.length, at = i => ring[(i + count) % count];
  let tip = 0;
  for (let i = 0; i < count; i++) if (Math.hypot(...ring[i]) > Math.hypot(...ring[tip])) tip = i;
  const near = [];
  for (let i = -1500; i <= 1500; i++) near.push([at(tip + i), at(tip + i + 1)]);
  const distance = ([x, y]) => Math.min(...near.map(([a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  }));
  const centre = i => {
    const a = at(i - 1), b = at(i + 1), dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    return [at(i)[0] - radius * dy / length, at(i)[1] + radius * dx / length];
  };
  const fits = i => distance(centre(i)) >= radius * (1 - 1e-4);
  let before = tip, after = tip;
  while (!fits(before)) before--;
  while (!fits(after)) after++;
  const [ca, cb] = [centre(before), centre(after)], c = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2];
  const start = Math.atan2(at(before)[1] - c[1], at(before)[0] - c[0]);
  let end = Math.atan2(at(after)[1] - c[1], at(after)[0] - c[0]);
  while (end <= start) end += turn;
  const steps = Math.max(8, Math.ceil((end - start) / (turn / 256)));
  const arc = Array.from({ length: steps - 1 }, (_, k) => {
    const angle = start + (end - start) * (k + 1) / steps, r = (Math.hypot(at(before)[0] - c[0], at(before)[1] - c[1])
      * (steps - k - 1) + Math.hypot(at(after)[0] - c[0], at(after)[1] - c[1]) * (k + 1)) / steps;
    return [c[0] + r * Math.cos(angle), c[1] + r * Math.sin(angle)];
  });
  const result = [];
  for (let i = 0; i < count; i++) {
    const offset = ((i - tip) % count + count + count / 2) % count - count / 2;
    if (offset > before - tip && offset < after - tip) { if (offset === before - tip + 1) result.push(...arc); continue; }
    result.push(ring[i]);
  }
  return result;
}
const driverRing = roundTip(traced, tipRadius);
const driver = [driverRing];

// Forward-only quasistatic projection (study-single-tooth-constrained-motion
// with CHECK_OUTPUT_CORNERS=1, SEATED_START=1).
const slotAngles = Array.from({ length: n }, (_, i) => Math.PI + i * pitch);
const slots = slotAngles.map(a => [Math.cos(a), Math.sin(a)]);
const locks = slotAngles.map(a => [D * Math.cos(a + half), D * Math.sin(a + half)]);
const inputSolid = makeSingleToothStarSolid(driverRing), corners = [];
for (const a of slotAngles) {
  const alpha = Math.acos((D * D + Rout * Rout - (R + clearance) ** 2) / (2 * D * Rout));
  for (const sign of [-1, 1]) {
    const t = a + half + sign * alpha; corners.push([Rout * Math.cos(t), Rout * Math.sin(t)]);
    const x = Math.sqrt(Rout * Rout - slotRadius * slotRadius), y = sign * slotRadius;
    corners.push([x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  }
}
const penetrate = (point, q) => {
  const x = point[0] * Math.cos(q) + point[1] * Math.sin(q), y = -point[0] * Math.sin(q) + point[1] * Math.cos(q);
  let depth = Rout - Math.hypot(x, y);
  if (depth <= 0) return depth;
  for (let i = 0; i < n; i++) {
    const [cx, cy] = locks[i]; depth = Math.min(depth, Math.hypot(x - cx, y - cy) - R - clearance);
    if (depth <= 0) return depth;
    const [ux, uy] = slots[i], along = x * ux + y * uy, across = -x * uy + y * ux;
    depth = Math.min(depth, Math.hypot(Math.max(0, slotCenter - along), across) - slotRadius);
    if (depth <= 0) return depth;
  }
  return depth;
};
const lockSeat = Math.acos((D * D + Rout * Rout - (R + clearance) ** 2) / (2 * D * Rout))
  - Math.acos((D * D + Rout * Rout - R * R) / (2 * D * Rout));
const initialQ = -half - lockSeat;
let q = initialQ;
const rows = [];
for (let i = 0; i <= phaseSteps; i++) {
  const angle = 0.8 - 1.6 * i / phaseSteps, c = Math.cos(angle), s = Math.sin(angle);
  const active = driverRing.map(([x, y]) => [x * c - y * s - D, x * s + y * c]).filter(v => Math.hypot(...v) < Rout + 1e-5);
  const intrusion = out => {
    let worst = active.reduce((maximum, v) => Math.max(maximum, penetrate(v, out)), 0);
    for (const [x, y] of corners) {
      const wx = D + x * Math.cos(out) - y * Math.sin(out), wy = x * Math.sin(out) + y * Math.cos(out);
      worst = Math.max(worst, inputSolid.penetration([wx * c + wy * s, -wx * s + wy * c]));
    }
    return worst;
  };
  const previous = q;
  if (intrusion(q) > 1e-7) {
    const firstAllowed = (low, high) => {
      const mid = (low + high) / 2, depth = intrusion(mid);
      if (depth - Rout * (high - low) / 2 > 1e-7) return null;
      if (high - low < 1e-10) {
        for (const at of [low, mid, high]) if (intrusion(at) <= 1e-7) return at;
        return null;
      }
      return firstAllowed(low, mid) ?? firstAllowed(mid, high);
    };
    const free = firstAllowed(q, half + 0.02);
    if (free === null) throw new Error(`No permitted output pose at step ${i}`);
    q = free;
  }
  rows.push({ angle, q, advance: q - previous });
}

// Output wheel exactly as generate-single-tooth-trimmed-profile builds it.
const rotate = (poly, a) => poly.map(ring => ring.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]));
const cuts = [];
const slot = clipping.union(circle(-slotCenter, 0, slotRadius, 1024),
  [[[-1.7, -slotRadius], [-slotCenter, -slotRadius], [-slotCenter, slotRadius], [-1.7, slotRadius]]]);
for (let i = 0; i < n; i++) {
  cuts.push(slot.map(poly => rotate(poly, i * pitch)));
  cuts.push(rotate(circle(-D, 0, R + clearance, 4096), i * pitch + pitch / 2));
}
const output = clipping.difference(circle(0, 0, Rout, 4096), ...cuts);
if (output.length !== 1) throw new Error('Disconnected output');

const p = { notches: n, pitch, centerDistance: D, driverRadius: R, outputRadius: Rout, slotRadius, slotCenter,
  upperReliefExtension, clipReliefToRim, upperReliefMode, tipRadius, initialQ, lockSeat, phaseSteps,
  checkOutputCorners: true, outputCorners: corners.length, sourceAngle: Math.PI / 4, depth: 0.24, driverSpeed: 1,
  period: turn, halfPitch: half, clearance };
const significant = rows.filter(r => r.advance > 1e-8);
const data = { parameters: p, driver, output: output[0], motionRows: rows.map(r => [r.angle, r.q]) };

// Entry event (resolve-single-tooth-entry-event).
const field = makeSingleToothConstraintField(data), first = rows.findIndex(row => row.advance > 1e-8);
const before = rows[first - 1], after = rows[first];
let high = before.angle, low = after.angle;
if (field.atAngle(high)(before.q) > 1e-7 || field.atAngle(low)(before.q) <= 1e-7) throw new Error('Entry rows do not bracket contact');
for (let i = 0; i < 48; i++) {
  const mid = (high + low) / 2;
  if (field.atAngle(mid)(before.q) > 1e-7) low = mid; else high = mid;
}
const entryAngle = (high + low) / 2;
data.motionRows.splice(data.motionRows.findIndex(row => row[0] < entryAngle), 0, [entryAngle, before.q]);
p.entryTime = p.sourceAngle - entryAngle; p.exitTime = p.sourceAngle - significant.at(-1).angle;
p.cycleClosureError = q - initialQ - pitch;
const text = '// Source-fitted plates and offline quasistatic contact path for movement 068.\n'
  + '// Generated by scripts/generate-single-tooth-rounded-profile.mjs (tooth tip rounded to Brown\'s form).\n'
  + 'export default ' + JSON.stringify(data) + ';\n';
console.log({ tipRadius, driverVertices: driverRing.length, entryTime: p.entryTime, exitTime: p.exitTime,
  cycleClosureError: p.cycleClosureError, peakAdvance: Math.max(...rows.map(r => r.advance)) });
if (check) {
  const current = await readFile(target, 'utf8');
  console.log(current === text ? 'unchanged' : 'differs');
} else await writeFile(target, text);
