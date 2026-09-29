import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import polygonClipping from 'polygon-clipping';
import { createAuthoredGuernseyEscapementMovement } from '../src/simulation/authored-guernsey-escapements.js';
import {
  DESIGN, gearing, leverAngleAt, leverOutline, leverRange, pitch, rackLayout, rotateAbout, seats, solveWheel, toothCorners, wheelOutline,
} from '../src/simulation/guernsey-anchor.js';
import { guernseyAnchorBake } from '../src/simulation/baked/guernsey-anchor-402.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const model = createAuthoredGuernseyEscapementMovement(catalog.movements[401]);
const { root } = model, d = root.userData, b = d.blocks;
const O = DESIGN.wheelCenter;
const close = (ring) => [...ring, ring[0]];
const areaOf = (multi) => multi.reduce((sum, polygon) => sum + polygon.reduce((s, ring, k) => {
  let a = 0; for (let i = 0; i < ring.length - 1; i += 1) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return s + (k ? -1 : 1) * Math.abs(a / 2);
}, 0), 0);
const lever = leverOutline();
const wheel = wheelOutline();
const leverAt = (theta) => close(lever.outer.map((q) => rotateAbout(q, theta)));
const wheelAt = (angle) => close(wheel.map((q) => { const r = rotateAbout(q, angle); return [r[0] + O[0], r[1] + O[1]]; }));

test('402 has exactly the drawn parts: one lever/anchor plate, one wheel plate, two balances with pinions, arbors and the bridge', () => {
  const roles = [];
  root.traverse((o) => { if (o.isMesh && o.visible) roles.push(o.userData.role); });
  assert.deepEqual(roles.sort(), [
    'escape-wheel-collet', 'escape-wheel-fixed-arbor', 'escape-wheel-single-plate-twelve-saw-teeth',
    'fixed-bridge-carrying-lever-and-escape-wheel-arbors',
    'left-balance-collar-to-pinion', 'left-balance-fixed-arbor', 'left-balance-involute-pinion', 'left-balance-rear-bearing', 'left-balance-see-through-web', 'left-balance-wheel',
    'lever-B-anchor-A-and-single-toothed-arm-one-plate', 'lever-B-fixed-arbor',
    'upper-balance-collar-to-pinion', 'upper-balance-fixed-arbor', 'upper-balance-involute-pinion', 'upper-balance-rear-bearing', 'upper-balance-see-through-web', 'upper-balance-wheel',
  ].sort());
  // The lever, anchor, bar and toothed arm are one simply connected outline.
  assert.equal(lever.holes.length, 1);
  assert.equal(b.leverPlate.geometry.userData.outline.holes.length, 1);
  // Brown draws each balance as a plain rim: no bar; the rim and hub are
  // joined by a thin see-through web, sunk into both and off their faces.
  for (const side of [b.upper, b.left]) {
    assert.equal(side.web.userData.seeThrough, true);
    assert.equal(side.web.castShadow, false);
    side.wheel.geometry.computeBoundingBox(); side.web.geometry.computeBoundingBox();
    const w = side.wheel.geometry.boundingBox, v = side.web.geometry.boundingBox;
    assert.ok(v.min.z > w.min.z + 0.01 && v.max.z < w.max.z - 0.01, 'web faces off the rim faces');
    const p = side.wheel.geometry.attributes.position; let barPoints = 0;
    for (let i = 0; i < p.count; i += 1) { const r = Math.hypot(p.getX(i), p.getY(i)); if (r > 0.2 && r < 1.3) barPoints += 1; }
    assert.equal(barPoints, 0, 'no bar between hub and rim');
  }
});

test('402 the single arm carries internal teeth for the upper pinion and external teeth for the left one, as Brown draws', () => {
  const g = gearing();
  // Brown: the upper pinion sits on the concave (inner) side of the arm, the
  // left pinion on its convex (outer) side.
  assert.ok(g.dUpper < g.bandInner - g.rp, 'upper pinion inside the arm');
  assert.ok(g.dLeft > g.bandOuter + g.rp, 'left pinion outside the arm');
  assert.ok(Math.abs(g.internalRadius - g.dUpper - g.rp) < 1e-12);
  assert.ok(Math.abs(g.dLeft - g.externalRadius - g.rp) < 1e-12);
  // Upper teeth run up the arm from the bar, lower teeth down from it.
  const racks = rackLayout();
  assert.ok(Math.max(...racks.internal) < lever.barAngle && Math.min(...racks.external) > lever.barAngle);
  assert.ok(racks.internal.length >= 7 && racks.external.length >= 7);
  // Brown draws long runs of fine teeth and 18-20-tooth pinions: sixteen
  // teeth per run, every one of which passes its pitch point over the swing.
  assert.equal(DESIGN.pinionTeeth, 20);
  assert.equal(racks.internal.length, 16);
  assert.equal(racks.external.length, 16);
  const [lo, hi] = leverRange();
  assert.ok(hi - lo >= 26 * Math.PI / 180 - 1e-12, 'lever swing at least 26 degrees');
  for (const [list, R, center] of [[racks.internal, g.internalRadius, g.upperAngle], [racks.external, g.externalRadius, g.leftAngle]]) {
    const beta = Math.PI * g.m / R;
    for (const a of list) assert.ok(center - a >= lo - 1.5 * beta - 1e-12 && center - a <= hi + 1.5 * beta + 1e-12, 'every rack tooth comes into mesh');
  }
  // The upper run reaches Brown's top end (his last tooth at 98.7 degrees
  // about B), and the lower run reaches at least 185 degrees.
  const DEGREE = Math.PI / 180;
  assert.ok(racks.internal[0] <= 98.8 * DEGREE && racks.external.at(-1) >= 185 * DEGREE);
  assert.ok(Math.abs(leverAngleAt(0)) < 1e-12, 'the lever passes the plate pose at phase 0');
  // The two runs are each concentric with B, stepped at the bar: the lower
  // run's plain back lies inside its external teeth, the upper's outside its
  // internal teeth.
  assert.ok(Math.abs(g.upperBand[0] - g.bandInner) < 1e-12 && Math.abs(g.lowerBand[1] - g.bandOuter) < 1e-12);
  assert.ok(g.upperBand[1] - g.upperBand[0] >= 0.15 && g.lowerBand[1] - g.lowerBand[0] >= 0.15);
  // Counter-oscillation: upper turns with the lever, left against it.
  assert.ok(g.upperRatio > 0 && g.leftRatio < 0);
  const s1 = d.stateAtTime(0.1), s0 = d.stateAtTime(0);
  assert.ok((s1.upperBalanceAngle - s0.upperBalanceAngle) * (s1.leftBalanceAngle - s0.leftBalanceAngle) < 0);
});

test('402 the wheel has Brown\'s twelve saw teeth, steep faces clockwise of their tips, and turns clockwise', () => {
  assert.equal(DESIGN.teeth, 12);
  assert.equal(DESIGN.sense, -1);
  const t = toothCorners(0);
  assert.ok(Math.atan2(t.frontRoot[1], t.frontRoot[0]) < 0, 'front root lies clockwise of the tip');
  assert.ok(guernseyAnchorBake.advancePerPeriod < 0);
});

test('402 the bake is current and the wheel advances exactly one tooth per lever period', () => {
  const sha = createHash('sha256').update(readFileSync(new URL('../src/simulation/guernsey-anchor.js', import.meta.url))).digest('hex');
  assert.equal(guernseyAnchorBake.source.sha256, sha, 'rerun node scripts/bake-guernsey-anchor-402.mjs');
  const again = solveWheel();
  assert.ok(!again.failed && again.unresolved === 0);
  const n = guernseyAnchorBake.steps;
  for (let i = 0; i <= n; i += 97) assert.ok(Math.abs(DESIGN.sense * (again.base + again.angles[i]) - guernseyAnchorBake.angles[i]) < 1e-8);
  const a = d.stateAtTime(0.3).wheelAngle, z = d.stateAtTime(0.3 + DESIGN.period).wheelAngle;
  assert.ok(Math.abs(a - z - pitch()) < 1e-9);
  // Recoil stays bounded.
  let back = 0;
  for (let i = 1; i <= n; i += 1) back = Math.max(back, guernseyAnchorBake.angles[i] - guernseyAnchorBake.angles[i - 1]);
  assert.ok(back < 0.01, `per-step recoil ${back}`);
});

test('402 pallet A hangs point-down as Brown draws it; the lower pallet seats flank-flush with its nose in the root', () => {
  const s = seats(), [, hi] = leverRange();
  // A at the plate pose: a narrow wedge, point down, both flanks within 15
  // degrees of vertical, point near Brown's (plate 353, 326).
  const [tip, left] = s.upper.flank, right = s.upper.back;
  for (const top of [left, right]) {
    assert.ok(top[1] - tip[1] > 0.4, 'point below the top');
    assert.ok(Math.abs(Math.atan2(top[0] - tip[0], top[1] - tip[1])) < 15 * Math.PI / 180, 'flank near vertical');
  }
  assert.ok(Math.hypot(tip[0] - 0.936, tip[1] - 0.072) < 0.04, 'point at Brown\'s');
  assert.ok(Math.hypot(right[0] - left[0], right[1] - left[1]) < 0.2, 'narrow wedge');
  // Lower pallet at the counter-clockwise extreme.
  const phase = (Math.PI / 2 - Math.asin(-DESIGN.leverCenter / DESIGN.leverAmplitude)) / (2 * Math.PI);
  assert.ok(Math.abs(leverAngleAt(phase * DESIGN.period) - hi) < 1e-12);
  const w = d.stateAtTime(phase * DESIGN.period).wheelAngle;
  const off = (w - s.lowerWheel) / pitch();
  assert.ok(Math.abs(off - Math.round(off)) < 0.01, `seat off by ${off}`);
  const t = toothCorners(3);
  const place = (q) => { const r = rotateAbout(q, s.lowerWheel); return [r[0] + O[0], r[1] + O[1]]; };
  const tipPt = place(t.tip), rootPt = place(t.frontRoot);
  const [nose, heel] = s.lower.flank.map((q) => rotateAbout(q, hi));
  const face = Math.atan2(tipPt[1] - rootPt[1], tipPt[0] - rootPt[0]), flank = Math.atan2(heel[1] - nose[1], heel[0] - nose[0]);
  assert.ok(Math.abs(Math.atan2(Math.sin(face - flank), Math.cos(face - flank))) < 1e-6, 'flank along the front face');
  assert.ok(Math.hypot(nose[0] - rootPt[0], nose[1] - rootPt[1]) <= DESIGN.palletSetback + 1e-9, 'nose in the root');
});

test('402 lever/anchor and wheel outlines never overlap over the period, and the pallets touch at lock', () => {
  let worst = 0, touching = 0;
  for (let i = 0; i < 240; i += 1) {
    const time = DESIGN.period * i / 240, s = d.stateAtTime(time);
    const overlap = areaOf(polygonClipping.intersection([leverAt(s.leverAngle)], [wheelAt(s.wheelAngle)]));
    worst = Math.max(worst, overlap);
    // Contact: nudging the wheel forward by 2e-4 rad makes it overlap.
    const nudged = areaOf(polygonClipping.intersection([leverAt(s.leverAngle)], [wheelAt(s.wheelAngle + DESIGN.sense * 2e-3)]));
    if (nudged > 0) touching += 1;
  }
  assert.ok(worst < 2e-6, `overlap ${worst}`);
  assert.ok(touching > 200, `wheel in contact at ${touching}/240 samples`);
});

test('402 rack teeth and pinions mesh without interference and keep working flanks close', () => {
  const g = gearing();
  const pinion = (mesh, center, angle) => close(mesh.geometry.userData.outline.map((v) => {
    const r = rotateAbout([v.x, v.y], angle); return [r[0] + center[0], r[1] + center[1]];
  }));
  let worst = 0, maxGap = 0;
  for (let i = 0; i < 120; i += 1) {
    const s = d.stateAtTime(DESIGN.period * i / 120), L = leverAt(s.leverAngle);
    for (const [mesh, center, angle] of [[b.upper.pinion, DESIGN.upperCenter, s.upperBalanceAngle], [b.left.pinion, DESIGN.leftCenter, s.leftBalanceAngle]]) {
      const P = pinion(mesh, center, angle);
      worst = Math.max(worst, areaOf(polygonClipping.intersection([L], [P])));
      // Working flanks: a slightly swollen pinion must touch the rack.
      const grow = close(P.slice(0, -1).map((q) => [center[0] + (q[0] - center[0]) * 1.03, center[1] + (q[1] - center[1]) * 1.03]));
      if (areaOf(polygonClipping.intersection([L], [grow])) === 0) maxGap += 1;
    }
  }
  assert.ok(worst < 1e-6, `gear overlap ${worst}`);
  assert.equal(maxGap, 0, 'pinions stay engaged');
  assert.ok(g.rp > 0.2);
});

test('402 working parts share one plane; balances lie behind in separate planes', () => {
  const { planes } = d.geometry;
  const z = (mesh) => mesh.geometry.userData.outline ? [mesh.geometry.userData.outline.z0, mesh.geometry.userData.outline.z1] : null;
  assert.deepEqual(z(b.leverPlate), [planes.working.low, planes.working.high]);
  assert.deepEqual(z(b.wheelPlate), [planes.working.low, planes.working.high]);
  assert.ok(planes.upperBalance.high < planes.working.low && planes.leftBalance.high < planes.upperBalance.low);
  assert.ok(planes.bridge.low > planes.working.high + 0.05);
});
