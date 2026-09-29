// p101: regenerates src/data/single-tooth-index-profile.js (movement 068)
// with an ideal tooth A: symmetric about its centre line, a round tip,
// straight flanks, and two mirror-image notches in B's rim with circular
// floors and straight walls. The output wheel, the forward-only
// quasistatic projection and the entry event repeat
// generate-single-tooth-rounded-profile.mjs.
//
// Usage: node scripts/generate-single-tooth-ideal-profile.mjs [--tip-radius=0.065] [--tooth-angle=0.43]
//   [--taper=10] [--notch-radius=0.1] [--notch-floor=1.13] [--lean=20] [--out=file] [--check]
import { readFile, writeFile } from 'node:fs/promises';
import clipping from 'polygon-clipping';
import { makeSingleToothStarSolid } from './lib/single-tooth-star-solid.mjs';
import { makeSingleToothConstraintField } from './lib/single-tooth-constraint-field.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const hit = args.find(arg => arg.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const tipRadius = option('tip-radius', 0.065), check = args.includes('--check');
const target = args.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'src/data/single-tooth-index-profile.js';

const turn = 2 * Math.PI, n = 10, pitch = turn / n, half = pitch / 2;
const D = 2.72, R = 1.36, Rout = 1.417, slotRadius = 0.12, slotCenter = 1.337, clearance = 0.00015;
const upperReliefExtension = 0.08, clipReliefToRim = true, upperReliefMode = 'distributed', phaseSteps = 6400;

const circle = (x, y, r, count = 256) => [Array.from({ length: count }, (_, i) =>
  [x + r * Math.cos(turn * i / count), y + r * Math.sin(turn * i / count)])];

// p101: an ideal tooth A, symmetric about its centre line: a round tip of
// radius tipRadius and straight flanks converging by toothTaper towards it.
// Each flank runs tangent into the circular floor (radius notchRadius,
// deepest at notchFloor) of a notch in B's rim, whose outer wall is a
// straight line leaning notchLean from the radial out to the rim. The two
// notches are mirror images, replacing the traced flanks and notch wobble.
const deg = Math.PI / 180, toothAngle = option('tooth-angle', 0.43) * deg, tipOuter = Rout;
const toothTaper = option('taper', 10) * deg, notchRadius = option('notch-radius', 0.1);
const notchFloor = option('notch-floor', 1.13), notchLean = option('lean', 20) * deg;
const add2 = (a, b, t = 1) => [a[0] + t * b[0], a[1] + t * b[1]];
const tipCentre = [tipOuter - tipRadius, 0];
const flankNormal = [Math.sin(toothTaper), Math.cos(toothTaper)], inward = [-Math.cos(toothTaper), Math.sin(toothTaper)];
const tipTangent = add2(tipCentre, flankNormal, tipRadius);
const offset = add2(tipTangent, flankNormal, notchRadius);
const qb = 2 * (offset[0] * inward[0] + offset[1] * inward[1]), qc = offset[0] ** 2 + offset[1] ** 2 - (notchFloor + notchRadius) ** 2;
const floorCentre = add2(offset, inward, (-qb - Math.sqrt(qb * qb - 4 * qc)) / 2);
const floorAngle = Math.atan2(floorCentre[1], floorCentre[0]);
const wall = [Math.cos(floorAngle + notchLean), Math.sin(floorAngle + notchLean)];
let wallNormal = [-wall[1], wall[0]];
if (wallNormal[0] * -Math.sin(floorAngle) + wallNormal[1] * Math.cos(floorAngle) < 0) wallNormal = wallNormal.map(x => -x);
const wallTangent = add2(floorCentre, wallNormal, notchRadius);
const flankTangent = add2(floorCentre, flankNormal, -notchRadius);
// One notch (y > 0 side): the floor disc plus the strip between the flank
// line and the wall line out beyond the rim.
const far = 0.6, notchSide = clipping.union(circle(...floorCentre, notchRadius, 2048),
  [[flankTangent, add2(flankTangent, inward, -far), add2(wallTangent, wall, far), wallTangent]]);
const mirror = multi => multi.map(poly => poly.map(ring => ring.map(([x, y]) => [x, -y])));
const turnPoly = (poly, a) => poly.map(ring => ring.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]));
const tooth = clipping.union(circle(...tipCentre, tipRadius, 1024),
  [[add2(tipCentre, flankNormal, tipRadius), add2(add2(tipCentre, flankNormal, tipRadius), inward, far),
    add2(add2(tipCentre, [flankNormal[0], -flankNormal[1]], tipRadius), [inward[0], -inward[1]], far),
    add2(tipCentre, [flankNormal[0], -flankNormal[1]], tipRadius)]]);
const idealDriver = turnPoly(clipping.difference(clipping.union(circle(0, 0, R, 4096), tooth),
  notchSide, mirror(notchSide))[0], toothAngle);
if (idealDriver.length !== 1) throw new Error('driver has holes');
const driverRing = (() => { const ring = idealDriver[0].slice(0, -1); let start = 0;
  for (let i = 0; i < ring.length; i++) if (Math.atan2(ring[i][1], ring[i][0]) < Math.atan2(ring[start][1], ring[start][0])) start = i;
  const out = [...ring.slice(start), ...ring.slice(0, start)];
  const area = out.reduce((s, [x, y], i) => s + x * out[(i + 1) % out.length][1] - out[(i + 1) % out.length][0] * y, 0);
  return area > 0 ? out : out.reverse(); })();
console.log({ floorCentreDeg: floorAngle / deg, floorCentreRadius: Math.hypot(...floorCentre),
  rimEndDeg: null, tipTangentRadius: Math.hypot(...tipTangent) });
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
    if (free === null) {
      const drv = active.reduce((m, v) => Math.max(m, penetrate(v, q)), 0);
      let cor = 0, which = -1; corners.forEach(([x, y], k) => { const wx = D + x * Math.cos(q) - y * Math.sin(q), wy = x * Math.sin(q) + y * Math.cos(q);
        const d = inputSolid.penetration([wx * c + wy * s, -wx * s + wy * c]); if (d > cor) { cor = d; which = k; } });
      throw new Error(`No permitted output pose at step ${i} angle ${angle} q ${q}: driver-in-C ${drv}, C-corner ${which} in driver ${cor}`);
    }
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

const p = { idealTooth: true, toothAngle, toothTaper, notchRadius, notchFloor, notchLean, notches: n, pitch, centerDistance: D, driverRadius: R, outputRadius: Rout, slotRadius, slotCenter,
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
  + '// Generated by scripts/generate-single-tooth-ideal-profile.mjs (p101: symmetric tooth, round tip, arc notches).\n'
  + 'export default ' + JSON.stringify(data) + ';\n';
console.log({ tipRadius, driverVertices: driverRing.length, entryTime: p.entryTime, exitTime: p.exitTime,
  cycleClosureError: p.cycleClosureError, peakAdvance: Math.max(...rows.map(r => r.advance)) });
if (check) {
  const current = await readFile(target, 'utf8');
  console.log(current === text ? 'unchanged' : 'differs');
} else await writeFile(target, text);
