import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { densePoints } from './helpers/dense-points.mjs';
import { solidSurface } from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const create = () => createMovementModel(catalog.movements[297]);

test('298 is a balance-geared crown wheel driving wire-loop pallets over a saw escape wheel', () => {
  const model = create();
  const { blocks, geometry } = model.root.userData;
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.crownToothSolids.length, 30);
  assert.equal(geometry.toothCount, 26);
  assert.equal(geometry.pinionTeeth, 12);
  assert.ok(Math.abs(geometry.gearRatio - 30 / 12) < 1e-12, 'balance turns 2.5 times the arbor');
  // Rack-pinion mesh at the crown's top: the pinion axis is one pitch radius
  // beyond the crown teeth's pitch line.
  assert.ok(Math.abs(geometry.staffX - geometry.pitchLineX - geometry.pinionRadius) < 1e-12);
  assert.equal(model.root.userData.hideGround, true);
  assert.equal(model.root.userData.sourceAnimation.available, false);
});

test('298 wire loops are round-wire tubes wrapped over the arbor, not blades behind it', () => {
  const { blocks, geometry: g } = create().root.userData;
  for (const loop of [blocks.pallet1, blocks.pallet2]) {
    assert.equal(loop.geometry.type, 'TubeGeometry');
    assert.equal(loop.geometry.parameters.radius, g.wireRadius);
    assert.equal(loop.parent, blocks.arbor, 'the loop turns with the arbor');
    const radii = loop.userData.centerline.map((p) => Math.hypot(p.y, p.z));
    // Carried by the arbor: the top of the loop sinks into the rod surface.
    assert.ok(Math.min(...radii) < g.arborRadius + g.wireRadius - 0.005, 'soldered over the arbor');
    assert.ok(Math.max(...radii) < g.arborRadius + 0.3, 'hangs only to the tooth tips');
  }
});

test('298 both loops lean the same way, tops to the left, as Brown draws them, and clear each other', () => {
  const { blocks, geometry: g } = create().root.userData;
  const lines = [blocks.pallet1, blocks.pallet2].map((loop) => loop.userData.centerline);
  for (const line of lines) {
    const lowest = line.reduce((a, b) => (b.y < a.y ? b : a));
    const highest = line.reduce((a, b) => (b.y > a.y ? b : a));
    const lean = (highest.x - lowest.x) / (highest.y - lowest.y);
    // Brown's loop axes run about 0.34 px left per px of rise.
    assert.ok(lean < -0.25 && lean > -0.45, `loop lean ${lean}`);
  }
  let closest = Infinity;
  for (const a of lines[0]) for (const b of lines[1]) closest = Math.min(closest, a.distanceTo(b));
  assert.ok(closest > 2 * g.wireRadius + 0.02, `loops ${closest} apart`);
});

test('298 contacting teeth touch the wire at exactly the running clearance and both drops are equal', () => {
  const model = create();
  const d = model.root.userData, g = d.geometry;
  let contacts = 0;
  for (let i = 0; i <= 800; i += 1) {
    const time = 4 * i / 800, state = d.stateAtTime(time);
    if (!state.activePallet) continue;
    const side = state.activePallet === 2 ? 1 : -1;
    const phi = d.contactTipAngle(side, state.arborAngle);
    assert.ok(Math.abs(d.helixGap(side, state.arborAngle, phi) - g.contactDistance) < 2e-6, `wire touches at ${time}`);
    // The played wheel angle puts an actual tooth tip at that contact angle.
    const offset = phi - Math.PI / 2 - state.wheelAngle;
    assert.ok(Math.abs(offset - Math.round(offset / g.pitch) * g.pitch) < 1e-9, `rendered tooth at contact ${time}`);
    contacts += 1;
  }
  assert.ok(contacts > 300);
  assert.ok(g.dropAngles.first > 0.02 && Math.abs(g.dropAngles.first - g.dropAngles.second) < 1e-9);
});

test('298 turns counterclockwise only: one tooth per period, no recoil and no jumps', () => {
  const d = create().root.userData, g = d.geometry;
  let previous = d.stateAtTime(0), maxStep = 0, minStep = Infinity;
  for (let i = 1; i <= 4000; i += 1) {
    const state = d.stateAtTime(8 * i / 4000);
    maxStep = Math.max(maxStep, Math.abs(state.wheelAngle - previous.wheelAngle));
    minStep = Math.min(minStep, state.wheelAngle - previous.wheelAngle);
    assert.ok(state.wheelSpeed > -1e-9, `wheel never turns back (${state.wheelSpeed} at ${8 * i / 4000})`);
    previous = state;
  }
  assert.ok(minStep > -1e-12, 'no recoil');
  assert.ok(maxStep < 0.002, `max wheel step ${maxStep}`);
  // Landings happen as the arbor reverses, so the wheel only rests for an instant.
  for (const time of [d.times.catch2, d.times.catch1]) {
    assert.ok(Math.abs(d.stateAtTime(time - 1e-7).wheelSpeed) < 1e-3);
    assert.ok(Math.abs(d.stateAtTime(time).arborSpeed) < 1e-9);
  }
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
