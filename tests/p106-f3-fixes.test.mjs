import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { capstanPawlDimensions, makeCrownRatchetGeometry } from '../src/simulation/capstan-pawl-contact.js';

// Pass 106 (lane f3): moving water on 438/439/445/446/463, 458's closed base
// and clear pour, 489's pivot hub, 475's clean necks, 491's round ratchet.
const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const model = (id) => createMovementModel(catalog.movements[id - 1]);
const byRole = (root, role) => {
  const found = [];
  root.traverse((o) => { if (o.userData?.role === role) found.push(o); });
  return found;
};

for (const id of [445, 446]) {
  test(`${id} falling stream, cone and sheet stream, and the supply and discharge run`, () => {
    const m = model(id);
    const body = m.root.userData.blocks.waterBody;
    assert.ok(body.material.map && body.material.userData.waterStream !== undefined);
    const T = m.root.userData.geometry.cycleDuration;
    const offsets = [0.10, 0.12, 0.50, 0.52].map((p) => { m.update(p * T); return body.material.map.offset.y; });
    assert.notEqual(offsets[0], offsets[1]);
    assert.notEqual(offsets[2], offsets[3]);
    // Seamless: the offset at the end of the loop equals the start.
    m.update(0); const a = body.material.map.offset.y;
    m.update(T); const b = body.material.map.offset.y;
    assert.ok(Math.abs(THREE.MathUtils.euclideanModulo(a - b + 0.5, 1) - 0.5) < 1e-6);
    for (const role of ['constant-supply-current-along-conduit', 'lower-discharge-current-along-floor-channel']) {
      const [current] = byRole(m.root, role);
      assert.ok(current?.userData.waterStream, role);
    }
  });
}

test('438 pour, 439 fall and 463 nappe wear the shared streak look', () => {
  const m438 = model(438);
  const [pour] = byRole(m438.root, 'water-falling-from-flume-into-shaft-hopper');
  assert.ok(pour.userData.waterStream && pour.streakRate >= 3);
  const m439 = model(439);
  const [fall] = byRole(m439.root, 'continuous-vertical-water-stream-through-bucket-station');
  assert.ok(fall.userData.waterStream);
  m439.update(1); const a = fall.material.map.offset.y;
  m439.update(1.3); assert.notEqual(fall.material.map.offset.y, a);
  const m463 = model(463);
  const [nappe] = byRole(m463.root, 'ordinary-overflow-stream-through-upper-leaf-notch');
  assert.ok(nappe.material.userData.waterStream);
  m463.update(1.2); const c = nappe.material.map.offset.y;
  m463.update(1.5); assert.notEqual(nappe.material.map.offset.y, c);
});

test('458 bucket base is in the stave colour and the pour falls clear of the post', () => {
  const m = model(458);
  const { blocks, geometry } = m.root.userData;
  for (const side of [blocks.leftBucket, blocks.rightBucket]) {
    const [body, floor] = side.bucket.userData.parts;
    assert.equal(floor.material, body.material);
  }
  const posts = blocks.frame.children.slice(0, 2).map((p) => new THREE.Box3().setFromObject(p));
  const pours = byRole(m.root, 'water-poured-from-tipped-bucket');
  let checked = 0;
  for (let i = 0; i <= 60; i += 1) {
    m.update(geometry.cycleDuration * i / 60);
    m.root.updateMatrixWorld(true);
    for (const pour of pours) {
      if (!pour.visible) continue;
      const box = new THREE.Box3().setFromObject(pour);
      for (const post of posts) assert.ok(!box.intersectsBox(post), `pour clear of post at ${i}`);
      checked += 1;
    }
  }
  assert.ok(checked > 4);
});

test('489 bucket plate carries a round hub along its pivot line', () => {
  const m = model(489);
  const panel = m.root.userData.blocks.buckets?.[0]?.panel
    ?? byRole(m.root, 'vertical-broad-face-of-bucket-a-1')[0];
  panel.geometry.computeBoundingBox();
  const box = panel.geometry.boundingBox;
  assert.ok(box.max.x - box.min.x > 0.47, 'hub diameter 0.48 across the 0.13 plate');
});

test('475 pipes B and C continue D\'s wall and bore at its necks', () => {
  const m = model(475);
  const { blocks } = m.root.userData;
  const radii = (mesh) => {
    const p = mesh.geometry.attributes.position; let lo = Infinity, hi = 0;
    for (let i = 0; i < p.count; i += 1) { const r = Math.hypot(p.getX(i), p.getZ(i)); lo = Math.min(lo, r); hi = Math.max(hi, r); }
    return [lo, hi];
  };
  const [cIn, cOut] = radii(blocks.dischargePipe);
  const [bIn, bOut] = radii(blocks.suctionPipe);
  assert.ok(Math.abs(cOut - 0.54) < 1e-3 && Math.abs(cIn - 0.475) < 1e-3);
  assert.ok(Math.abs(bOut - 0.47) < 1e-3 && Math.abs(bIn - 0.405) < 1e-3);
  const cBox = new THREE.Box3().setFromObject(blocks.dischargePipe);
  const bBox = new THREE.Box3().setFromObject(blocks.suctionPipe);
  assert.ok(Math.abs(cBox.min.y - 1.56) < 1e-6 && Math.abs(bBox.max.y + 1.16) < 1e-6);
});

test('491 crown ratchet has a round outer skirt, not one facet per tooth', () => {
  const g = makeCrownRatchetGeometry({ ...capstanPawlDimensions, phaseOffset: 0 });
  const p = g.attributes.position; const angles = new Set();
  for (let i = 0; i < p.count; i += 1) {
    if (Math.abs(Math.hypot(p.getX(i), p.getZ(i)) - capstanPawlDimensions.outerRadius) < 1e-5) {
      angles.add(Math.round(Math.atan2(p.getZ(i), p.getX(i)) * 1e5));
    }
  }
  assert.ok(angles.size >= capstanPawlDimensions.toothCount * 16);
});
