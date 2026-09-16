import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredSprocketMovement as create } from '../src/simulation/authored-sprockets.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

test('254 source edge proportions retain the short shaft and narrow bifurcated prongs', () => {
  const { geometry: g, sourceReference: { plate254: source } } = create({ id: 254 }).root.userData;
  const height = source.rasterWheelBodyBounds.bottom - source.rasterWheelBodyBounds.top;
  const width = source.rasterWheelBodyBounds.right - source.rasterWheelBodyBounds.left;
  const shaftWidth = source.rasterShaftBounds.right - source.rasterShaftBounds.left;
  assert.ok(Math.abs(g.wheelWidth / (2 * g.wheelBodyRadius) - width / height) < .01);
  assert.ok(Math.abs(g.shaftLength / (2 * g.wheelBodyRadius) - shaftWidth / height) < .01);
  const forkWidth = 2 * (g.forkHalfSpread + g.forkBarRadius);
  for (const fork of source.rasterForkProfiles) {
    assert.ok(Math.abs(forkWidth / (2 * g.wheelBodyRadius) - (fork.right - fork.left) / height) < .02);
  }
});

test('254 finite fork seat clears the prongs and a wider gauge intersects them', () => {
  const m = create({ id: 254 }), d = m.root.userData, g = d.geometry;
  m.root.updateMatrixWorld(true);
  for (const fork of d.blocks.forks) {
    const prong = fork.children.find(o => o.userData.role.endsWith('right-axial-prong'));
    const field = solidSurface(prong.geometry);
    const toProng = prong.matrixWorld.clone().invert().multiply(fork.matrixWorld);
    const seat = new THREE.Vector3(g.chainSeatHalfGap, g.chainSeatRadius, 0).applyMatrix4(toProng);
    const gap = field.signedDistance(seat);
    assert.ok(gap > -1e-6 && gap < .0012, `finite round-prong gap ${gap}`);
    const oversized = new THREE.Vector3(g.chainSeatHalfGap + .015, g.chainSeatRadius, 0).applyMatrix4(toProng);
    assert.ok(field.signedDistance(oversized) < -.005, 'oversized gauge must hit the real prong');
  }
});

test('254 bored hub/body clear the shaft while every fork is solidly attached', () => {
  const m = create({ id: 254 }), b = m.root.userData.blocks;
  m.root.updateMatrixWorld(true);
  for (const part of [b.hub, b.wheelBody]) {
    const field = solidSurface(part.geometry), transform = part.matrixWorld.clone().invert().multiply(b.shaft.matrixWorld);
    for (const p of surfacePoints(b.shaft.geometry)) {
      assert.ok(field.signedDistance(p.clone().applyMatrix4(transform), .005) > .004);
    }
  }
  for (const fork of b.forks) {
    const stem = fork.children.find(o => o.userData.role.endsWith('radial-stem'));
    const field = solidSurface(b.wheelBody.geometry), transform = b.wheelBody.matrixWorld.clone().invert().multiply(stem.matrixWorld);
    const minimum = Math.min(...surfacePoints(stem.geometry).map(p => field.signedDistance(p.clone().applyMatrix4(transform), .02)));
    assert.ok(minimum < -.02 + 1e-6, 'fork root has actual overlap inside the wheel');
  }
  const index = b.shaftIndex.position;
  assert.ok(Math.hypot(index.y, index.z) + .045 < m.root.userData.geometry.shaftRadius, 'face index fits entirely on the shaft');
});

test('254 fits all visible parts through a full cycle and retains legible stable playback', () => {
  const m = create({ id: 254 }), d = m.root.userData, saved = [], point = new THREE.Vector3();
  m.root.traverse(o => {
    if (o.geometry) saved.push([o, o.geometry, o.geometry.attributes.position.array]);
    for (const material of [].concat(o.material ?? [])) assert.equal(material.fog, false);
  });
  for (let i = 0; i <= 128; i++) {
    m.update(5 * i / 128); m.root.updateMatrixWorld(true);
    m.root.traverseVisible(o => {
      const a = o.geometry?.attributes.position;
      if (a) for (let j = 0; j < a.count; j++) {
        assert.ok(d.cameraFitBounds.containsPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld)));
      }
    });
  }
  for (const [o, geometry, array] of saved) { assert.equal(o.geometry, geometry); assert.equal(o.geometry.attributes.position.array, array); }
  assert.equal(d.hideGround, true); assert.equal(d.minimumDisplayCycleSeconds, 5);
  assert.ok(m.cameraDirection.z > 50 * m.cameraDirection.x);
  assert.match(d.reconstructionNote, /not validated chain engagement/);
});
