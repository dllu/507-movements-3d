import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { createAuthoredHeronsFountainMovement } from '../src/simulation/authored-herons-fountains.js';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const ARCHETYPE = 'herons-three-vessel-fountain-with-water-drain-shared-air-line-and-pressure-driven-central-jet';
const model464 = () => createAuthoredHeronsFountainMovement(catalog.movements[463]);

function inside(multipolygon, [x, y]) {
  const ringHas = (ring) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  return multipolygon.some(([outer, ...holes]) => ringHas(outer) && !holes.some(ringHas));
}

function box(object) {
  object.geometry.computeBoundingBox();
  return object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
}

test('movement 464 is Hero’s fountain: one hollow casting in section, a jet pipe and two water bodies', () => {
  const movement = catalog.movements[463];
  const { root } = model464();
  const { blocks } = root.userData;
  assert.equal(movement.id, 464);
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(root.userData.archetype, ARCHETYPE);
  assert.equal(root.userData.fidelity, 'authored');
  for (const key of ['casting', 'slab', 'jetPipe', 'rightWater', 'bowlWater']) assert.equal(blocks[key].parent, root, key);
  assert.equal(blocks.jets.length, 6);
  // The casting and the pipe are cut on z = 0 with their own cut faces.
  for (const part of [blocks.casting, blocks.slab, blocks.jetPipe]) {
    assert.equal(part.geometry.groups.length, 2, part.userData.role);
    box(part);
    assert.ok(part.geometry.boundingBox.max.z <= 1e-6, `${part.userData.role} stays behind the section plane`);
  }
  const roles = [];
  root.traverse((o) => { if (o.isMesh) roles.push(o.userData.role); });
  assert.equal(roles.filter((r) => /marker|tracer|bead|air/i.test(r)).length, 0);
});

test('movement 464 passages follow Brown’s section: open trough, water tube, air leg, bowl and foot', () => {
  const { root } = model464();
  const g = root.userData.geometry, { cavity, window, walls } = g.outlines;
  // Cavities.
  for (const [label, p] of [['trough', [0, 4.6]], ['trough up to the rim', [0, g.trough.rim - 0.01]], ['right tube', [1.53, 2.5]],
    ['left air leg', [-1.53, 2.5]], ['chamber over bowl', [0, 4.0]], ['bowl', [0, 3.0]], ['foot', [0, 0.4]],
    ['foot under the tube', [1.53, 0.15]], ['air leg meets the chamber', [-1.25, 4.05]]]) assert.ok(inside(cavity, p), label);
  // Solid walls and the open window.
  for (const [label, p] of [['trough floor', [-1.0, 4.25]], ['tube inner wall', [1.25, 2.5]], ['left leg inner wall', [-1.25, 2.5]],
    ['bowl wall', [0, g.bowl.centerY - 1.165]], ['foot floor', [0, 0.05]], ['window bottom wall', [0, 0.8]]]) assert.ok(inside(walls, p), label);
  for (let x = -2.15; x <= 2.15; x += 0.05) assert.ok(!inside(walls, [x, g.trough.rim - 0.01]), `no lid over the trough at x ${x.toFixed(2)}`);
  assert.ok(inside(window, [0, 2.0]), 'window through the frame under the bowl');
  assert.ok(!inside(cavity, [1.25, 4.0]), 'the tube is walled off from the chamber');
  // One connected cavity region per purpose: the trough, tube and foot join;
  // the left leg joins the foot to the chamber; the bowl is part of the chamber.
  assert.equal(polygonClipping.intersection(cavity, [[[[-3, 0], [3, 0], [3, 6], [-3, 6], [-3, 0]]]]).length, 1, 'one connected hollow');
});

test('movement 464 hydrostatics: sealed tube foot, submerged pipe foot, positive jet head', () => {
  const { root } = model464();
  const g = root.userData.geometry;
  assert.ok(g.tubeEnd < g.footLevel, 'the tube ends under the foot water (air cannot escape up it)');
  assert.ok(g.footLevel < g.foot.ogeeBottom && g.footLevel < g.foot.ceiling, 'air stands over the foot water');
  assert.ok(g.pipe.bottom < g.bowlLevel && g.bowlLevel < g.bowl.centerY, 'the pipe foot is under the bowl water, the bowl not overfull');
  assert.ok(g.troughLevel < g.trough.rim && g.troughLevel > g.trough.floor, 'the open trough holds water below its rim');
  assert.equal(g.airGaugeHead, g.troughLevel - g.footLevel);
  assert.ok(Math.abs(g.idealJetHead - (g.airGaugeHead - (g.pipe.tip - g.bowlLevel))) < 1e-12);
  assert.ok(g.idealJetHead > g.visibleJetRise && g.visibleJetRise > 0);
  for (const phase of [0, 0.3, 0.7, 1]) {
    const s = root.userData.stateAtPhase(phase);
    assert.equal(s.drainFlowRate, s.jetFlowRate, 'drain carries the jet return');
    assert.equal(s.footLevel, g.footLevel);
    assert.equal(s.bowlLevel, g.bowlLevel);
  }
});

test('movement 464 water bodies are continuous, clear of every wall and behind the section plane', () => {
  const { root } = model464();
  root.updateMatrixWorld(true);
  const g = root.userData.geometry, { rightWater, bowlWater, jets } = root.userData.blocks;
  const zBack = -g.depth / 2 + g.cover;
  const right = box(rightWater), bowl = box(bowlWater);
  assert.ok(Math.abs(right.min.y - (g.foot.floor + g.gap)) < 1e-5 && Math.abs(right.max.y - g.troughLevel) < 1e-5, 'foot floor to trough surface');
  assert.ok(Math.abs(bowl.max.y - (g.pipe.tip - g.gap)) < 1e-5, 'bowl water stands up the pipe to the tip');
  assert.ok(bowl.min.y > g.bowl.centerY - g.bowl.inner, 'bowl water inside the bowl');
  for (const b of [right, bowl]) {
    assert.ok(b.max.z <= -g.gap + 1e-6 && b.min.z >= zBack + g.gap - 1e-6, 'off the cut plane and the back wall');
  }
  // Each jet leaves the spire tip and ends on the trough water.
  for (const jet of jets) {
    const points = jet.path.points, first = points[0], last = points.at(-1);
    assert.ok(Math.abs(first.y - g.pipe.tip) < 1e-9 && Math.abs(first.x) < 1e-9);
    assert.ok(Math.abs(last.y - g.troughLevel) < 1e-4, 'lands on the trough water');
    assert.ok(Math.abs(last.x) < g.trough.innerHalf, 'lands inside the trough');
  }
});

test('movement 464 renders through the registry with finite bounds', () => {
  const model = createMovementModel(catalog.movements[463]);
  for (const phase of [0, 0.36, 0.9]) {
    model.update(phase * model.root.userData.geometry.cycleDuration);
    model.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model.root);
    assert.ok(Number.isFinite(bounds.min.x) && Number.isFinite(bounds.max.y));
    assert.ok(model.root.userData.cameraFitBounds.containsBox(bounds));
  }
});
