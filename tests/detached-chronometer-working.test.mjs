import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredLeverChronometerMovement as chronometer } from '../src/simulation/authored-lever-chronometers.js';
import { densePoints } from './helpers/dense-points.mjs';
import { solidSurface } from './helpers/solid-surface.mjs';

const movement = { id: 314, archetype: 'thirteen-tooth-single-impulse-lever-chronometer-alternating-long-short-lock-transfer-escapement', description: '' };

// Finite rendered solids, not the contact equations: every working pair of
// the flat parts stays clear through a full oscillation, apart from the
// seated locking and impulse contacts (within the 0.0015 running clearance
// the pallets are cut with).
test('314 flat working parts clear each other through the cycle', () => {
  const m = chronometer(movement);
  const b = m.root.userData.blocks;
  const g = m.root.userData.geometry;
  const pairs = [
    [b.wheelPlate, b.crescent],
    [b.wheelPlate, b.directPalletC],
    [b.balancePin, b.leverBody],
    ...b.bankingPins.map((pin) => [pin, b.leverBody]),
    [b.balanceDisc, b.leverBody],
  ];
  const cache = new Map();
  const prepared = (mesh) => {
    if (!cache.has(mesh)) cache.set(mesh, { points: densePoints(mesh.geometry, 0.02), field: solidSurface(mesh.geometry) });
    return cache.get(mesh);
  };
  const q = new THREE.Vector3();
  const deepest = (a, c) => {
    const relative = c.matrixWorld.clone().invert().multiply(a.matrixWorld);
    const target = prepared(c);
    let depth = 0;
    for (const p of prepared(a).points) {
      q.copy(p).applyMatrix4(relative);
      if (target.field.box.containsPoint(q) && target.field.inside(q)) depth = Math.max(depth, target.field.distance(q));
    }
    return depth;
  };
  let worst = { depth: 0 };
  for (let i = 0; i <= 96; i += 1) {
    const time = g.balancePeriod * i / 96;
    m.update(time);
    m.root.updateMatrixWorld(true);
    for (const [a, c] of pairs) {
      const depth = Math.max(deepest(a, c), deepest(c, a));
      if (depth > worst.depth) worst = { depth, time, pair: `${a.userData.role} x ${c.userData.role}` };
    }
  }
  assert.ok(worst.depth <= 0.0016, `${worst.pair} penetrates ${worst.depth} at ${worst.time}`);
});

test('314 foot banks on each real pin at the ends of its throw', () => {
  const m = chronometer(movement);
  const { blocks: b, geometry: g, stateAtTime } = m.root.userData;
  for (const [name, index, sign] of [['left', 0, -1], ['right', 1, 1]]) {
    // Find a time the lever rests at that bank.
    let time = 0;
    for (let i = 0; i < 400; i += 1) {
      const t = g.balancePeriod * i / 400;
      if (Math.abs(stateAtTime(t).leverAngle - sign * g.leverAmplitude) < 1e-12) { time = t; break; }
    }
    m.update(time);
    m.root.updateMatrixWorld(true);
    const contact = g.bankingContactPoints[name];
    const world = new THREE.Vector3(contact.x, contact.y, g.leverPlaneZ);
    const gap = solidSurface(b.bankingPins[index].geometry).signedDistance(b.bankingPins[index].worldToLocal(world.clone()), 0.01);
    assert.ok(gap >= -1e-5 && gap < 0.002, `${name} contact gap ${gap}`);
    near(contact.distanceTo(g.bankingPinCenters[name]), g.bankingPinRadius, 1e-12, `${name} pin tangent`);
  }
});

function near(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}

test('314 parts are single flat extrusions in Brown’s three planes', () => {
  const m = chronometer(movement);
  const { blocks: b, planes } = m.root.userData;
  const zRange = (mesh) => {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    return [box.min.z + mesh.position.z, box.max.z + mesh.position.z];
  };
  const close = (a, e) => a.every((v, i) => Math.abs(v - e[i]) < 1e-6);
  assert.ok(close(zRange(b.wheelPlate), planes.front), 'wheel in the front plane');
  assert.ok(close(zRange(b.crescent), planes.front), 'crescent in the front plane');
  assert.ok(close(zRange(b.directPalletC), planes.front), 'C in the front plane');
  assert.ok(close(zRange(b.leverBody), planes.lever), 'lever behind');
  assert.ok(close(zRange(b.balanceDisc), planes.balance), 'disc behind the lever');
  // Brown draws no frame: the only fixed parts are the banking pins.
  assert.deepEqual(b.fixedFrame.children, b.bankingPins);
  // No stand or bracket in front of the movement.
  m.root.updateMatrixWorld(true);
  for (const part of b.fixedFrame.children) {
    const box = new THREE.Box3().setFromObject(part);
    assert.ok(box.max.z <= planes.lever[1] + 1e-6, `${part.userData.role} stays behind the front plane`);
  }
  let visibleMarkers = 0;
  m.root.traverse((o) => { if (o.isMesh && /marker|index|witness|edge/.test(o.userData.role ?? '')) visibleMarkers += 1; });
  assert.equal(visibleMarkers, 0);
});
