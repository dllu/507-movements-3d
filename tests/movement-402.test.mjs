import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import polygonClipping from 'polygon-clipping';
import { createAuthoredGuernseyEscapementMovement } from '../src/simulation/authored-guernsey-escapements.js';
import {
  DESIGN, gearing, leverAngleAt, leverOutline, pitch, rackLayout, rotateAbout, seats, solveWheel, toothCorners, wheelOutline,
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
    'left-balance-collar-to-pinion', 'left-balance-fixed-arbor', 'left-balance-involute-pinion', 'left-balance-rear-bearing', 'left-balance-wheel',
    'lever-B-anchor-A-and-single-toothed-arm-one-plate', 'lever-B-fixed-arbor',
    'upper-balance-collar-to-pinion', 'upper-balance-fixed-arbor', 'upper-balance-involute-pinion', 'upper-balance-rear-bearing', 'upper-balance-wheel',
  ].sort());
  // The lever, anchor, bar and toothed arm are one simply connected outline.
  assert.equal(lever.holes.length, 1);
  assert.equal(b.leverPlate.geometry.userData.outline.holes.length, 1);
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

test('402 each pallet seats flank-flush with its nose in the root at the end of its swing', () => {
  const s = seats(), A = DESIGN.leverAmplitude;
  for (const [pallet, phase, theta, k] of [[s.upper, 0.75, -A, 0], [s.lower, 0.25, A, 3]]) {
    const w = d.stateAtTime(phase * DESIGN.period).wheelAngle;
    // The baked wheel is exactly at the seat, modulo a pitch.
    const seatWheel = pallet === s.upper ? s.upperWheel : s.lowerWheel;
    const off = (w - seatWheel) / pitch();
    assert.ok(Math.abs(off - Math.round(off)) < 0.01, `seat off by ${off}`);
    const turn = seatWheel; // the wheel outline repeats every pitch
    const t = toothCorners(k);
    const place = (q) => { const r = rotateAbout(q, turn); return [r[0] + O[0], r[1] + O[1]]; };
    const tip = place(t.tip), rootPt = place(t.frontRoot);
    const [nose, heel] = pallet.flank.map((q) => rotateAbout(q, theta));
    const face = Math.atan2(tip[1] - rootPt[1], tip[0] - rootPt[0]), flank = Math.atan2(heel[1] - nose[1], heel[0] - nose[0]);
    assert.ok(Math.abs(Math.atan2(Math.sin(face - flank), Math.cos(face - flank))) < 1e-6, 'flank along the front face');
    assert.ok(Math.hypot(nose[0] - rootPt[0], nose[1] - rootPt[1]) <= DESIGN.palletSetback + 1e-9, 'nose in the root');
  }
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
