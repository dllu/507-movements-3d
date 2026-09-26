import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredLanternEscapementMovement as create } from '../src/simulation/authored-lantern-escapements.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

test('297: real rotating arbors clear both fixed journals and the bored rear plate', () => {
  const m = create({ id: 297 }), d = m.root.userData;
  const pairs = d.lanternWorkingParts.pairs, samples = new Map(), fields = new Map();
  for (const [a, b] of pairs) { samples.set(a, surfacePoints(a.geometry)); fields.set(b, solidSurface(b.geometry)); }
  let minimum = .01, count = 0;
  for (let i = 0; i <= 64; i++) {
    m.update(d.geometry.armPeriod * i / 64); m.root.updateMatrixWorld(true);
    for (const [a, b] of pairs) {
      const matrix = b.matrixWorld.clone().invert().multiply(a.matrixWorld);
      for (const p of samples.get(a)) {
        const gap = fields.get(b).signedDistance(p.clone().applyMatrix4(matrix), .01);
        minimum = Math.min(minimum, gap); count++;
        assert.ok(gap > -1e-5, `${i}: ${a.userData.role} / ${b.userData.role}: ${gap}`);
      }
    }
  }
  console.log({ count, minimum });
});

test('297: each trundle passes through the disc, and both journals join the rear support', () => {
  const m = create({ id: 297 }), b = m.root.userData.blocks; m.root.updateMatrixWorld(true);
  const overlap = (a, c) => {
    return Math.min(...[[a, c], [c, a]].map(([from, to]) => {
      const field = solidSurface(to.geometry), matrix = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      return Math.min(...surfacePoints(from.geometry).map(p => field.signedDistance(p.clone().applyMatrix4(matrix), .04)));
    }));
  };
  for (const spoke of b.sidePlateSpokes) {
    const index = spoke.position.z < 0 ? 0 : 1;
    assert.ok(overlap(spoke, b.sidePlates[index]) < -.01, 'spoke must reach ring');
    assert.ok(overlap(spoke, b.wheelHubs[index]) < -.01, 'spoke must join hub');
  }
  for (const trundle of b.trundles) for (const plate of b.sidePlates)
    assert.ok(overlap(trundle, plate) < -.005, 'trundle must pass through the disc');
  for (const journal of [b.wheelBearing, b.armBearing])
    assert.ok(overlap(journal, b.standard) < -.01, 'fixed journal must join support plate');
});

test('297: stable visible-cycle framing, readable timing and explicit working-contact limits', () => {
  const m = create({ id: 297 }), d = m.root.userData, resources = [], point = new THREE.Vector3();
  m.root.traverse(o => { if (o.geometry) resources.push([o, o.geometry, o.geometry.attributes.position.array]);
    for (const material of [].concat(o.material ?? [])) assert.equal(material.fog, false); });
  for (let i = 0; i <= 64; i++) {
    m.update(d.geometry.armPeriod * i / 64); m.root.updateMatrixWorld(true);
    m.root.traverseVisible(o => { const a = o.geometry?.attributes.position;
      if (a) for (let j = 0; j < a.count; j++) assert.ok(d.cameraFitBounds.containsPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld))); });
  }
  for (const [o, geometry, array] of resources) { assert.equal(o.geometry, geometry); assert.equal(o.geometry.attributes.position.array, array); }
  assert.equal(d.hideGround, true); assert.equal(d.minimumDisplayCycleSeconds, 4);
  assert.match(d.reconstructionNote, /offline projection removes solver overlap/);
});
