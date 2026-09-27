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
    'water-annulus-in-gap-between-tubes-a-and-b-at-atmospheric-level',
  ]) assert.ok(found.includes(role), role);
  assert.ok(!found.some((role) => /counterweight|pulley|gas-marker/.test(role)), 'no counterweight gear');
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
    near(blocks.water.underRim.position.y + blocks.water.underRim.scale.y, s.bellY - 0.004, 1e-9, `water under the rim meets it at ${t}`);
    near(blocks.underSleeveWater.position.y + blocks.underSleeveWater.scale.y, s.bellY - 0.004, 1e-9, `water under a meets it at ${t}`);
  }
  near(g.waterY - g.innerWaterY, g.gaugePressurePascal / (998 * 9.80665) * 8 / 3, 1e-9, 'pressure head');
  model.root.updateMatrixWorld(true);
  const gapWater = new THREE.Box3().setFromObject(blocks.sleeveGapWater);
  near(gapWater.max.y, g.waterY, 1e-6, 'water between a and b at the free level');
  const a = stateAtTime(0), b = stateAtTime(g.cycleDuration);
  near(a.bellY, b.bellY, 1e-12, 'loop closes');
  disposeModel(model.root);
});
