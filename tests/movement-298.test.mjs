import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { densePoints } from './helpers/dense-points.mjs';
import { solidSurface } from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const create = () => createMovementModel(catalog.movements[297]);

test('298 is a balance-geared crown wheel driving helical pallets over a saw escape wheel', () => {
  const model = create();
  const { blocks, geometry } = model.root.userData;
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.crownToothSolids.length, 30);
  assert.equal(geometry.toothCount, 20);
  assert.equal(geometry.pinionTeeth, 12);
  assert.ok(Math.abs(geometry.gearRatio - 30 / 12) < 1e-12, 'balance turns 2.5 times the arbor');
  // Rack-pinion mesh at the crown's top: the pinion axis is one pitch radius
  // beyond the crown teeth's pitch line.
  assert.ok(Math.abs(geometry.staffX - geometry.pitchLineX - geometry.pinionRadius) < 1e-12);
  assert.equal(model.root.userData.hideGround, true);
  assert.equal(model.root.userData.sourceAnimation.available, false);
});

test('298 contacting tooth corners ride the helical pallet faces and both drops are positive and equal', () => {
  const model = create();
  const d = model.root.userData, g = d.geometry;
  let contacts = 0;
  for (let i = 0; i <= 2000; i += 1) {
    const time = 4 * i / 2000, state = d.stateAtTime(time);
    if (!state.activePallet) continue;
    const side = state.activePallet === 2 ? 1 : -1;
    const phi = d.contactTipAngle(side, state.arborAngle);
    const x = g.escapeCenter.x + g.tipRadius * Math.cos(phi);
    assert.ok(Math.abs(x - d.palletX(side, state.arborAngle, phi)) < 1e-9, `corner on helix at ${time}`);
    // The played wheel angle puts an actual tooth tip at that contact angle.
    const offset = phi - Math.PI / 2 - state.wheelAngle;
    assert.ok(Math.abs(offset - Math.round(offset / g.pitch) * g.pitch) < 1e-9, `rendered tooth at contact ${time}`);
    contacts += 1;
  }
  assert.ok(contacts > 1000);
  assert.ok(g.dropAngles.first > 0.02 && Math.abs(g.dropAngles.first - g.dropAngles.second) < 1e-9);
});

test('298 advances one tooth per balance period, counterclockwise, without jumps', () => {
  const d = create().root.userData, g = d.geometry;
  let previous = d.stateAtTime(0), maxStep = 0;
  for (let i = 1; i <= 4000; i += 1) {
    const state = d.stateAtTime(8 * i / 4000);
    maxStep = Math.max(maxStep, Math.abs(state.wheelAngle - previous.wheelAngle));
    previous = state;
  }
  assert.ok(maxStep < 0.002, `max wheel step ${maxStep}`);
  assert.ok(Math.abs(d.stateAtTime(4).wheelAngle - d.stateAtTime(0).wheelAngle - g.pitch) < 1e-9);
  assert.ok(Math.abs(d.stateAtTime(0.5).balanceAngle - g.gearRatio * d.stateAtTime(0.5).arborAngle) < 1e-12);
});

function closedMeshes(group) {
  const meshes = [];
  group.traverse((object) => {
    if (!object.isMesh) return;
    meshes.push({ mesh: object, points: densePoints(object.geometry, 0.03), field: solidSurface(object.geometry) });
  });
  return meshes;
}
function worstPenetration(model, phases) {
  const b = model.root.userData.blocks;
  const groups = [closedMeshes(b.escapeRotor), closedMeshes(b.arbor), closedMeshes(b.staff)];
  let worst = { depth: 0 };
  const q = new THREE.Vector3();
  for (let i = 0; i <= phases; i += 1) {
    const time = 4 * i / phases;
    model.update(time); model.root.updateMatrixWorld(true);
    const boxes = new Map(groups.flat().map((item) => [item, item.field.box.clone().applyMatrix4(item.mesh.matrixWorld)]));
    for (let x = 0; x < 3; x += 1) for (let y = x + 1; y < 3; y += 1) for (const a of groups[x]) for (const c of groups[y]) {
      if (!boxes.get(a).intersectsBox(boxes.get(c))) continue;
      for (const [s, t] of [[a, c], [c, a]]) {
        const relative = t.mesh.matrixWorld.clone().invert().multiply(s.mesh.matrixWorld);
        for (const p of s.points) {
          q.copy(p).applyMatrix4(relative);
          if (!t.field.box.containsPoint(q) || !t.field.inside(q)) continue;
          const depth = t.field.distance(q);
          if (depth > worst.depth) worst = { depth, time, pair: `${s.mesh.userData.role} x ${t.mesh.userData.role}` };
        }
      }
    }
  }
  return worst;
}

test('298 escape wheel, pallet arbor and balance staff clear each other through the cycle', () => {
  const worst = worstPenetration(create(), 96);
  assert.equal(worst.depth, 0, `${worst.pair} penetrates ${worst.depth} at ${worst.time}`);
});

test('negative control: a pinion half a pitch out of phase jams the crown teeth', () => {
  const model = create();
  const rotor = model.root.userData.blocks.pinion.userData.rotor;
  const update = model.update;
  model.update = (time) => { update(time); rotor.rotation.z += Math.PI / 12; };
  assert.ok(worstPenetration(model, 24).depth > 0.02);
});
