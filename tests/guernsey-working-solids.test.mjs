// Movement 402: checks on the rendered solids themselves (not the 2D model
// behind them): moving parts never cut each other or the fixed arbors, the
// pinions keep close working flanks, and no faces are shared.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createAuthoredGuernseyEscapementMovement } from '../src/simulation/authored-guernsey-escapements.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

const movement = JSON.parse(readFileSync(new URL('../src/data/movements.json', import.meta.url))).movements[401];
const m = createAuthoredGuernseyEscapementMovement(movement), r = m.root, b = r.userData.blocks;
const period = r.userData.timeline.demonstrationPeriod;
const cache = new Map();
const pointsOf = (g) => { if (!cache.has(g)) cache.set(g, { points: surfacePoints(g), solid: solidSurface(g) }); return cache.get(g); };

function worstPenetration(pairs, times, band = 0.004) {
  let worst = { distance: 1 };
  for (const time of times) {
    m.update(time); r.updateMatrixWorld(true);
    for (const pair of pairs) for (const [a, z] of [pair, [...pair].reverse()]) {
      const matrix = z.matrixWorld.clone().invert().multiply(a.matrixWorld), { solid } = pointsOf(z.geometry);
      for (const pt of pointsOf(a.geometry).points) {
        const p = pt.clone().applyMatrix4(matrix);
        if (solid.box.distanceToPoint(p) > band) continue;
        const d = solid.signedDistance(p, band);
        if (d < worst.distance) worst = { distance: d, time, a: a.userData.role, z: z.userData.role };
      }
    }
  }
  return worst;
}

test('402 rendered lever/anchor, wheel and pinions never cut each other over a period', () => {
  const pairs = [[b.wheelPlate, b.leverPlate], [b.upper.pinion, b.leverPlate], [b.left.pinion, b.leverPlate]];
  const worst = worstPenetration(pairs, Array.from({ length: 49 }, (_, i) => period * i / 48));
  assert.ok(worst.distance > -2e-4, JSON.stringify(worst));
});

test('402 moving parts clear the fixed arbors, bearings and bridge', () => {
  const fixed = [b.leverArbor, b.wheelArbor, b.upper.arbor, b.left.arbor, b.upper.bearing, b.left.bearing, b.bridge];
  const moving = [b.leverPlate, b.wheelPlate, b.collet, b.upper.wheel, b.upper.collar, b.upper.pinion, b.left.wheel, b.left.collar, b.left.pinion];
  const pairs = [];
  for (const f of fixed) for (const mv of moving) pairs.push([f, mv]);
  const worst = worstPenetration(pairs, [0, 0.13, 0.27, 0.41].map((x) => x * period));
  assert.ok(worst.distance > -1e-6, JSON.stringify(worst));
});

test('402 the balances never cut the lever, the wheel or each other', () => {
  const pairs = [[b.upper.wheel, b.left.wheel], [b.upper.wheel, b.leverPlate], [b.left.wheel, b.leverPlate],
    [b.upper.wheel, b.left.collar], [b.left.wheel, b.upper.collar], [b.upper.collar, b.leverPlate], [b.left.collar, b.leverPlate]];
  const worst = worstPenetration(pairs, [0, 0.1, 0.2, 0.3, 0.4].map((x) => x * period));
  assert.ok(worst.distance > -1e-6, JSON.stringify(worst));
});

test('402 scene flags, buffers and see-through bridge are stable', () => {
  assert.ok(m.cameraDirection.z > 15);
  assert.equal(r.userData.hideGround, true);
  assert.equal(r.userData.minimumDisplayCycleSeconds, 6);
  const snapshot = () => { const g = []; let n = 0; r.traverse((o) => { n += 1; if (o.geometry) g.push(o.geometry.attributes.position); }); return { n, g }; };
  const before = snapshot();
  for (let i = 0; i <= 12; i += 1) m.update(i / 2);
  const after = snapshot();
  assert.equal(after.n, before.n); assert.deepEqual(after.g, before.g);
  r.traverse((o) => {
    for (const mat of [o.material].flat().filter(Boolean)) assert.equal(mat.fog, false);
    if (o.isMesh) assert.equal(o.castShadow, !o.userData.seeThrough);
  });
  assert.equal(b.bridge.userData.seeThrough, true);
});

test('402 collars do not share bores or faces with their pinions or balances', () => {
  r.updateMatrixWorld(true);
  const minRadius = (g) => { const p = g.attributes.position; let lo = Infinity; for (let i = 0; i < p.count; i += 1) lo = Math.min(lo, Math.hypot(p.getX(i), p.getY(i))); return lo; };
  for (const side of [b.upper, b.left]) {
    assert.ok(minRadius(side.collar.geometry) > minRadius(side.pinion.geometry) + 0.005);
    assert.ok(minRadius(side.collar.geometry) > minRadius(side.wheel.geometry) + 0.005);
    const c = new THREE.Box3().setFromObject(side.collar), p = new THREE.Box3().setFromObject(side.pinion), w = new THREE.Box3().setFromObject(side.wheel);
    assert.ok(c.max.z > p.min.z + 0.005 && c.max.z < p.max.z, 'collar ends inside the pinion');
    assert.ok(c.min.z < w.max.z - 0.005 && c.min.z > w.min.z, 'collar starts inside the balance');
  }
});
