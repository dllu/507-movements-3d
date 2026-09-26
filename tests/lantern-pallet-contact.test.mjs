import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredLanternEscapementMovement as create } from '../src/simulation/authored-lantern-escapements.js';
import { finiteContacts297, lanternContact297 as c } from '../src/simulation/lantern-pallet-contact.js';
import { lanternState297 as state, lanternBake297 as bake } from '../src/simulation/lantern-pallet-playback.js';
import { solidSurface, surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';

test('297: full finite circles clear both finite bars between bake samples', () => {
  let minimum = Infinity; const ranges = { B: [Infinity, -Infinity], C: [Infinity, -Infinity] }, counts = { B: 0, C: 0 };
  for (let i = 0; i <= 16000; i++) {
    const s = state(i / 4000), hits = finiteContacts297(s.wheelAngle, s.armAngle);
    minimum = Math.min(minimum, hits[0].gap);
    assert.ok(hits[0].gap > 0, `${i}: ${JSON.stringify(hits[0])}`);
    if (s.contactActive) {
      const h = hits[0]; ranges[h.bar][0] = Math.min(ranges[h.bar][0], h.moment);
      ranges[h.bar][1] = Math.max(ranges[h.bar][1], h.moment); counts[h.bar]++;
      assert.ok(h.moment < -.85, 'loaded finite face must oppose CCW rotation');
    }
  }
  assert.ok(counts.B > 4000 && counts.C > 2000);
  console.log({ minimum, ranges, counts });
});

test('297: actual pin and pallet triangles clear in both directions, including end drops', () => {
  const m = create({ id: 297 }), b = m.root.userData.blocks;
  const bars = [b.palletBBody, b.palletCBody], barFields = bars.map(o => solidSurface(o.geometry)),
    pinPoints = surfacePoints(b.trundles[0].geometry), pinField = solidSurface(b.trundles[0].geometry), barPoints = bars.map(o => surfacePoints(o.geometry));
  const times = [...Array.from({ length: 129 }, (_, i) => i / 32), .24, .60, 1, 1.76, 2.24, 3.76, 2.56, 2.564, 3.80, 3.804, .181, 2.842];
  let minimum = .1;
  for (const t of times) {
    m.update(t); m.root.updateMatrixWorld(true);
    for (const pin of b.trundles) for (let j = 0; j < bars.length; j++) {
      const forward = bars[j].matrixWorld.clone().invert().multiply(pin.matrixWorld);
      for (const p of pinPoints) minimum = Math.min(minimum, barFields[j].signedDistance(p.clone().applyMatrix4(forward), .01));
      const reverse = forward.clone().invert();
      for (const p of barPoints[j]) minimum = Math.min(minimum, pinField.signedDistance(p.clone().applyMatrix4(reverse), .01));
    }
  }
  assert.ok(minimum > -1e-7, `actual finite surfaces: ${minimum}`);
  console.log({ actualSurfaceMinimum: minimum, poses: times.length });
});

test('297: ring, spokes and forward arm clear pallets and pin ends; bars stand straight off the one-piece arm', () => {
  const m = create({ id: 297 }), d = m.root.userData, b = d.blocks;
  m.update(0); m.root.updateMatrixWorld(true);
  const z = o => new THREE.Box3().setFromObject(o);
  const pallet = z(b.palletBBody), pin = z(b.trundles[0]), arm = z(b.armA);
  assert.ok(pallet.min.z > z(b.sidePlates[1]).max.z + .13);
  assert.ok(pallet.min.z > Math.max(...b.sidePlateSpokes.map(o => z(o).max.z)) + .14);
  assert.ok(pin.max.z > pallet.min.z + .27, 'full pin must share the complete working depth');
  assert.ok(arm.min.z > pin.max.z + .16, 'arm clears rotating pin ends');
  for (const body of [b.palletBBody, b.palletCBody]) {
    assert.ok(z(body).max.z > arm.min.z + .02, 'each bar reaches into the arm plate');
    assert.equal(body.parent.children.filter(o => /rigid-mount/.test(o.userData.role)).length, 0, 'no bridges');
  }
  // One flat arm plate carries both bars: no pins or bridges between planes.
  assert.ok(b.armA.geometry.userData.plate, 'arm A is one extruded plate');
  assert.equal(d.lanternFiniteContact.mounts, undefined);
});

test('297: actual loaded planar face normals oppose wheel rotation', () => {
  const m = create({ id: 297 }), b = m.root.userData.blocks, p = new THREE.Vector3();
  for (const t of [1.2, 1.8, 3.1, 3.5]) {
    const s = state(t); assert.ok(s.contactActive && !s.contact.end);
    m.update(t); m.root.updateMatrixWorld(true);
    const body = b[`pallet${s.contact.bar}Body`], local = body.worldToLocal(new THREE.Vector3(...s.contact.point, 1.06));
    const triangles = surfaceTriangles(body.geometry); let best = null, distance = Infinity;
    for (const tri of triangles) { const gap = tri.closestPointToPoint(local, p).distanceTo(local); if (gap < distance) { best = tri; distance = gap; } }
    const normal = best.getNormal(new THREE.Vector3()).transformDirection(body.matrixWorld);
    const moment = s.contact.point[0] * normal.y - s.contact.point[1] * normal.x;
    assert.ok(distance < 1e-6 && moment < -1.5, `${t}: ${distance}, ${moment}`);
  }
});

test('297: finite-end release inherits nonzero speed and the repeated bake has no seam jump', () => {
  for (const t of [2.56, 3.80]) {
    const s = state(t); assert.ok(s.contactActive && s.contact.end);
    assert.ok(Math.abs(s.contact.q[0]) > c.bars.find(b => b.name === s.contact.bar).length / 2);
  }
  for (const t of [2.57, 3.82]) assert.ok(!state(t).contactActive && state(t).wheelAngularSpeed > .4);
  for (const seam of [0, 1, 4, 5]) {
    let prior = Infinity;
    for (const e of [1e-4, 1e-5, 1e-6]) {
      const a = state(seam - e), b = state(seam + e), delta = Math.abs(a.wheelAngle - b.wheelAngle);
      assert.ok(delta <= prior + 1e-12);
      assert.ok(delta < 4 * e + 1e-12); prior = delta;
      if (e === 1e-6) assert.ok(Math.abs(a.wheelAngularSpeed - b.wheelAngularSpeed) < 2e-5);
    }
  }
});

test('297: bake qualification retains timestep, disabled-contact and projection bounds', () => {
  const m = bake.metadata;
  assert.ok(m.angleAgreement < .008);
  assert.equal(m.disabledContactCount, 0); assert.ok(m.disabledAdvance > 10 * c.pitch);
  for (const advance of m.steadyCycleAdvances) assert.ok(Math.abs(advance - c.pitch) < 1e-6);
  assert.ok(m.projectionMaximum < .0015);
  assert.match(m.method, /offline soft-overlap projection/);
});
