import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { createMovementModel } from '../src/simulation/registry.js';
import { DESIGN, rotate, toothGeometry } from '../src/simulation/six-point-anchor-238.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const model = createMovementModel(catalog.movements[237]);
const d = model.root.userData, g = d.geometry, e = d.escapement238;
const closed = ring => [[...ring, ring[0]]];
const area = polygons => polygons.reduce((sum, polygon) => sum + polygon.reduce((s, ring, k) => {
  let a = 0; for (let i = 0; i + 1 < ring.length; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return s + (k ? -1 : 1) * Math.abs(a) / 2;
}, 0), 0);
const posed = state => ({
  star: e.star.map(p => rotate(p, state.wheelAngle)),
  anchor: e.anchor.outline.map(p => rotate(p, state.palletAngle, DESIGN.pivotA)),
});
const lineDistance = (p, a, u) => Math.abs((p[0] - a[0]) * u[1] - (p[1] - a[1]) * u[0]);

test('238 has Brown\'s six-point star and one flat anchor in the wheel\'s plane', () => {
  assert.equal(g.toothCount, 6);
  assert.equal(d.blocks.escapeWheel.userData.teeth, 6);
  assert.equal(d.archetype, catalog.movements[237].archetype);
  assert.equal(d.transmission.palletsShareRigidCarrier, true);
  // Every working part is a single extrusion centred on z = 0.
  for (const mesh of [d.blocks.wheelBody, d.blocks.palletBody]) {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    assert.ok(Math.abs(box.min.z + g.plateDepth / 2) < 1e-6 && Math.abs(box.max.z - g.plateDepth / 2) < 1e-6);
  }
  // The star's points are identical (rotational symmetry) and blunt enough
  // to be sturdy: root radius over tip radius at least 0.6.
  assert.ok(DESIGN.rootRadius / DESIGN.tipRadius >= 0.6);
  const tips = Array.from({length: 6}, (_, k) => toothGeometry(k));
  for (const t of tips) assert.ok(Math.abs(Math.hypot(...t.center) - (DESIGN.tipRadius - DESIGN.tipRound)) < 1e-12);
  // No marker, index or standoff parts: 2 plates, 2 bosses, 2 arbors, 1 journal.
  let meshes = 0; model.root.traverse(o => { if (o.isMesh && o.visible) meshes++; });
  assert.ok(meshes <= 8, `${meshes} meshes`);
});

test('238 wheel motion is the baked contact search of the current design', async () => {
  const text = await readFile(new URL('../src/simulation/six-point-anchor-238.js', import.meta.url));
  assert.equal(e.wheel.source.sha256, createHash('sha256').update(text).digest('hex'), 'rerun scripts/bake-six-point-anchor-238.mjs');
  assert.ok(Math.abs(e.wheel.closure - g.toothPitch) < 1e-8, 'one tooth per oscillation');
});

test('238 B and C seat flat on a flank with their points in the root', () => {
  // Plate pose: B holds tooth 0 along its whole leading flank.
  const s0 = d.stateAtTime(0);
  assert.equal(s0.palletAngle, 0);
  assert.ok(Math.abs(s0.wheelAngle) < 1e-6);
  const t0 = toothGeometry(0), uB = e.anchor.B.direction;
  for (const p of [t0.leadingTangent, t0.leadingRoot]) assert.ok(lineDistance(p, e.anchor.B.corner, uB) < 2e-4);
  const bRoot = Math.hypot(...e.anchor.B.corner);
  assert.ok(bRoot < DESIGN.rootRadius + 0.05, `B corner ${bRoot} sits in the root`);
  // Half a cycle on: C holds tooth 2 the same way, half a pitch later.
  const s5 = d.stateAtTime(g.cyclePeriod / 2);
  assert.ok(Math.abs(s5.palletAngle - g.swing) < 1e-12);
  assert.ok(Math.abs(s5.wheelAngle - g.toothPitch / 2) < 2e-4);
  const t2 = toothGeometry(2), cPoint = rotate(e.anchor.C.point, g.swing, DESIGN.pivotA), uC = rotate(e.anchor.C.direction, g.swing);
  for (const p of [t2.leadingTangent, t2.leadingRoot].map(q => rotate(q, s5.wheelAngle))) assert.ok(lineDistance(p, cPoint, uC) < 2e-3);
  assert.ok(Math.hypot(...cPoint) < DESIGN.rootRadius + 0.05, 'C point sits in the root');
  // C's point in the plate pose is within 5 px of Brown's (290, 185).
  const c = e.anchor.C.point, source = [c[0] / 0.0165 + 214, 210 - c[1] / 0.0165];
  assert.ok(Math.hypot(source[0] - 290, source[1] - 185) < 5, `${source}`);
});

test('238 star never cuts the anchor, and each lock is a touching contact', () => {
  let worst = 0;
  for (let i = 0; i < 480; i++) {
    const s = posed(d.stateAtTime(g.cyclePeriod * i / 480));
    worst = Math.max(worst, area(polygonClipping.intersection(closed(s.star), closed(s.anchor))));
  }
  assert.ok(worst < 2e-5, `overlap area ${worst}`);
  for (const t of [0, 0.5]) {
    const s = d.stateAtTime(g.cyclePeriod * t);
    assert.equal(e.overlaps(s.wheelAngle + 0.003, s.palletAngle), true, `locked at ${t}`);
  }
});

test('238 one tooth per oscillation: lock, impulse, drop and small recoil', () => {
  let previous = d.stateAtTime(0).wheelAngle, recoil = 0, back = 0, maxStep = 0;
  for (let i = 1; i <= 2400; i++) {
    const w = d.stateAtTime(2 * g.cyclePeriod * i / 2400).wheelAngle;
    if (w < previous) back += previous - w; else { recoil = Math.max(recoil, back); back = 0; }
    maxStep = Math.max(maxStep, w - previous);
    previous = w;
  }
  assert.ok(Math.abs(previous - 2 * g.toothPitch) < 1e-6);
  assert.ok(recoil > 0 && recoil < THREE.MathUtils.degToRad(5), `recoil ${recoil}`);
  assert.ok(maxStep > 0, 'drops');
  for (const time of [0, 1.2, 2.2, 3.7, 5.1]) {
    model.update(time);
    const s = d.stateAtTime(time);
    assert.equal(d.blocks.escapeWheel.userData.rotor.rotation.z, s.wheelAngle);
    assert.equal(d.blocks.palletCarrier.rotation.z, s.palletAngle);
  }
  assert.equal(d.animationTiming.authoredCyclePeriod, g.cyclePeriod);
  assertReadableTiming(d.animationTiming);
});
