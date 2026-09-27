import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

// Pass 74: Brown's plate 479 re-measured (docs/p74-b-review.md): a tall bell
// in a masonry pit, bands over two plain pulleys to the ball weights C, and
// the two pipes rising through the floor from a channel beneath it.

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

function movementModel() {
  const movement = catalog.movements[478];
  return { model: createMovementModel(movement), movement };
}
function near(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}
function disposeModel(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    for (const material of [].concat(object.material ?? [])) material.dispose();
  });
}
// Pass 87: the water is one closed body (every edge shared by two faces in
// opposite directions), and below the bell's rim its only side walls are the
// tank's (and b's), so nothing divides it where the bell's wall used to be.
function assertWaterWhole(body, {rimY, radii, pipeXs, pipeOuter, message}) {
  const p = body.geometry.attributes.position, n = body.geometry.attributes.normal;
  const key = (i) => [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e5)).join(',');
  const edges = new Map();
  for (let i = 0; i < p.count; i += 3) for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
    const ka = key(a), kb = key(b), k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    edges.set(k, (edges.get(k) ?? 0) + (ka < kb ? 1 : -1));
  }
  assert.equal([...edges.values()].filter((v) => v !== 0).length, 0, `${message}: water closed and oriented`);
  for (let i = 0; i < p.count; i += 3) {
    if (Math.abs(n.getY(i)) > 0.5) continue;
    const ys = [0, 1, 2].map((k) => p.getY(i + k));
    if (Math.max(...ys) > rimY - 0.004 + 1e-6) continue;
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (pipeXs.some((px) => Math.hypot(x - px, z) < pipeOuter + 0.02)) continue;
    const r = Math.hypot(x, z);
    assert.ok(radii.some((allowed) => Math.abs(r - allowed) < 0.01), `${message}: water wall at r ${r.toFixed(3)} below the rim`);
  }
}
function roles(root) {
  const out = [];
  root.traverse((object) => {if (object.userData.role) out.push(object.userData.role);});
  return out;
}

test('movement 479 draws bell A in the masonry pit B, two pipes, two plain pulleys, bands and weights C, and nothing else', () => {
  const { model, movement } = movementModel();
  assert.equal(movement.id, 479);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  const found = roles(model.root);
  for (const role of [
    'fixed-ground-and-masonry-pit-forming-tank-B', 'open-bottomed-domed-vessel-A',
    'fixed-left-gas-inlet-through-bottom-of-B', 'fixed-right-gas-outlet-through-bottom-of-B',
    'fixed-axis-counterweight-pulley-1', 'fixed-axis-counterweight-pulley-2', 'counterweight-C-1', 'counterweight-C-2',
    'taut-inner-band-1-to-A', 'taut-outer-band-2-to-C',
  ]) assert.ok(found.includes(role), role);
  assert.ok(!found.some((role) => /guide-post|gas-marker|adjustment-disk/.test(role)));
  disposeModel(model.root);
});

test('movement 479 keeps Brown’s proportions: the bell is taller than it is wide and fills the pit', () => {
  const { model } = movementModel();
  const g = model.root.userData.geometry;
  assert.ok(g.skirtHeight > 2 * g.bellRadius, 'skirt taller than the bell is wide');
  near(g.skirtHeight / (2 * g.bellRadius), (655 - 190) / (720 - 300), 0.02, 'skirt height to width as drawn');
  near(g.pitRadius / g.bellRadius, (740 - 275) / (720 - 300), 0.02, 'pit to bell as drawn');
  // Brown's pose opens the cycle: rim just under the water, weights just
  // above the ground.
  const s0 = model.root.userData.stateAtTime(0);
  near(s0.bellY, g.topRimY, 1e-12, 'Brown’s pose at the top of the stroke');
  assert.ok(s0.counterweightY - g.ballRadius > g.groundY);
  disposeModel(model.root);
});

test('movement 479 keeps the water seal, the pipes above the water and the bell clear of floor and pipes through the stroke', () => {
  const { model } = movementModel();
  const { geometry: g, stateAtTime, blocks } = model.root.userData;
  for (let i = 0; i <= 64; i += 1) {
    const t = g.cycleDuration * i / 64;
    const s = stateAtTime(t);
    assert.ok(s.bellY < g.innerWaterY - 0.1, `rim sealed at ${t}`);
    assert.ok(s.bellY > g.floorY + 0.5, `rim above the floor at ${t}`);
    assert.ok(g.pipeTopY > g.innerWaterY && g.pipeTopY < s.bellY + g.skirtHeight, `pipes open inside the gas space at ${t}`);
    model.update(t);
    if (i % 8 === 0) {
      assertWaterWhole(blocks.water.body, {rimY: s.bellY, radii: [g.pitRadius - 0.004], pipeXs: g.pipeXs, pipeOuter: 0.125, message: `t ${t}`});
      const box = new THREE.Box3().setFromObject(blocks.water.body);
      near(box.max.y, g.waterY, 1e-6, `free level at ${t}`);
      near(box.min.y, g.floorY + 0.004, 1e-6, `water on the floor at ${t}`);
    }
    // Weights never reach the ground or their pulleys.
    assert.ok(s.counterweightY - g.ballRadius > g.groundY && s.counterweightY + g.ballRadius < g.pulleyCenters[0].y - g.pulleyRadius);
  }
  // Quasi-static balance: the head is the gauge pressure of the unbalanced weight.
  const area = Math.PI * (g.bellRadius / (8 / 3)) ** 2;
  near(g.gaugePressurePascal, (g.bellMassKilogram - 2 * g.counterweightMassKilogram) * 9.80665 / area, 1e-9, 'gauge pressure');
  near(g.waterY - g.innerWaterY, g.gaugePressurePascal / (998 * 9.80665) * 8 / 3, 1e-9, 'pressure head');
  disposeModel(model.root);
});

test('movement 479 bands are inextensible, the pulleys roll with them, and the loop closes', () => {
  const { model } = movementModel();
  const { geometry: g, stateAtTime, blocks } = model.root.userData;
  let length = null;
  for (const t of [0, 1.1, 2.7, 4, 5.3, 7.9]) {
    model.update(t);
    const s = stateAtTime(t);
    const total = blocks.innerBands[0].scale.y + blocks.outerBands[0].scale.y;
    if (length === null) length = total; else near(total, length, 1e-9, `band length at ${t}`);
    near(blocks.pulleys[0].rotor.rotation.z * -1 * g.pulleyRadius, g.topRimY - s.bellY, 1e-9, `pulley rolls with the band at ${t}`);
    near(s.counterweightY - g.topBallY, g.topRimY - s.bellY, 1e-12, `weight moves opposite to A at ${t}`);
  }
  const a = stateAtTime(0), b = stateAtTime(g.cycleDuration);
  near(a.bellY, b.bellY, 1e-12, 'loop closes');
  disposeModel(model.root);
});
