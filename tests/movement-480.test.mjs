import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

// Pass 74: Brown's plate 480 re-measured (docs/p74-b-review.md): a tall bell
// with its integral sleeve a sliding on the fixed tube b in a masonry pit.

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

function movementModel() {
  const movement = catalog.movements[479];
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

test('movement 480 draws bell A with sleeve a on the fixed tube b in the masonry pit B, with the two pipes', () => {
  const { model, movement } = movementModel();
  assert.equal(movement.id, 480);
  assert.equal(model.root.userData.archetype, movement.archetype);
  const found = roles(model.root);
  for (const role of [
    'fixed-ground-and-masonry-pit-forming-tank-B', 'open-bottomed-domed-vessel-A-around-sleeve-a', 'sliding-sleeve-a-secured-within-A',
    'fixed-hollow-shell-of-central-tube-b', 'fixed-left-gas-outlet-through-bottom-of-B', 'fixed-right-gas-inlet-through-bottom-of-B',
    'one-connected-water-column-in-tank-B-round-b-and-inside-and-outside-A',
    'base-of-vessel-A-from-skirt-to-sleeve-a-pierced-by-the-pipes',
  ]) assert.ok(found.includes(role), role);
  assert.ok(!found.some((role) => /counterweight|pulley|gas-marker/.test(role)), 'no counterweight gear');
  disposeModel(model.root);
});

test('movement 480 closes A with Brown’s base from the skirt to sleeve a, pierced with clearance by the fixed pipes', () => {
  const { model } = movementModel();
  const { geometry: g, blocks } = model.root.userData;
  const box = new THREE.Box3().setFromBufferAttribute(blocks.baseA.geometry.attributes.position);
  near(box.min.y, 0.003, 1e-6, 'base just above the rim (no face on the skirt’s)');
  near(box.max.y, g.baseThickness, 1e-6, 'base thickness');
  near(box.max.x, g.bellRadius - g.bellWall / 2, 1e-3, 'base runs into the skirt');
  // Each fixed pipe passes through its hole with clearance at every pose.
  const p = blocks.baseA.geometry.attributes.position;
  for (const x of g.pipeXs) {
    let closest = Infinity;
    for (let i = 0; i < p.count; i += 1) closest = Math.min(closest, Math.hypot(p.getX(i) - x, p.getZ(i)));
    near(closest, 0.12 + g.pipeClearance, 1e-3, 'pipe hole clearance');
  }
  disposeModel(model.root);
});

test('movement 480 keeps Brown’s proportions and pose', () => {
  const { model } = movementModel();
  const g = model.root.userData.geometry;
  near(g.skirtHeight / (2 * g.bellRadius), (690 - 240) / (725 - 240), 0.02, 'skirt height to width as drawn');
  near(g.pitRadius / g.bellRadius, (770 - 200) / (725 - 240), 0.02, 'pit to bell as drawn');
  near(g.sleeveOuter / g.bellRadius, (535 - 430) / (725 - 240), 0.02, 'sleeve to bell as drawn');
  near(model.root.userData.stateAtTime(0).bellY, g.midRimY, 1e-12, 'Brown’s pose at t = 0');
  disposeModel(model.root);
});

test('movement 480 sleeve a slides on b with clearance, b stands above a, and the water seal holds through the stroke', () => {
  const { model } = movementModel();
  const { geometry: g, stateAtTime, blocks } = model.root.userData;
  assert.ok(g.sleeveInner - g.tubeOuter > 0.02, 'running clearance between a and b');
  for (let i = 0; i <= 64; i += 1) {
    const t = g.cycleDuration * i / 64;
    const s = stateAtTime(t);
    assert.ok(s.bellY < g.innerWaterY - 0.1, `rim sealed at ${t}`);
    assert.ok(s.bellY > g.floorY + 0.5, `rim above the floor at ${t}`);
    assert.ok(s.bellY + g.sleeveTop < g.tubeTopY, `b stands above a at ${t}`);
    assert.ok(g.pipeTopY > g.innerWaterY && g.pipeTopY < s.bellY + g.skirtHeight, `pipes open into the gas at ${t}`);
    model.update(t);
    if (i % 8 === 0) {
      assertWaterWhole(blocks.water.body, {rimY: s.bellY, radii: [g.pitRadius - 0.004, g.tubeOuter + 0.004], pipeXs: g.pipeXs, pipeOuter: 0.12, message: `t ${t}`});
      // A's base sits between the water under it and the water inside A.
      const heights = blocks.water.heights;
      assert.ok(heights[1] < s.bellY && heights[2] > s.bellY + g.baseThickness, `water clear of the base at ${t}`);
    }
  }
  near(g.waterY - g.innerWaterY, g.gaugePressurePascal / (998 * 9.80665) * 8 / 3, 1e-9, 'pressure head');
  model.root.updateMatrixWorld(true);
  const water = new THREE.Box3().setFromObject(blocks.water.body);
  near(water.max.y, g.waterY, 1e-6, 'free level (outside A and between a and b)');
  const a = stateAtTime(0), b = stateAtTime(g.cycleDuration);
  near(a.bellY, b.bellY, 1e-12, 'loop closes');
  disposeModel(model.root);
});
