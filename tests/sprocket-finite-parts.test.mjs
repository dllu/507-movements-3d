import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredSprocketMovement as create } from '../src/simulation/authored-sprockets.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

const flatY = fork => fork.children.find(o => /chunky-flat-y-fork$/.test(o.userData.role ?? ''));
// Connected pieces of a mesh, welding coincident vertex positions.
const pieces = geometry => {
  const p = geometry.attributes.position, index = geometry.index, key = [], parent = [];
  const keys = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
    if (!keys.has(k)) { keys.set(k, keys.size); parent.push(keys.size - 1); }
    key.push(keys.get(k));
  }
  const find = a => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const count = index?.count ?? p.count;
  for (let i = 0; i < count; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => find(key[index ? index.getX(i + j) : i + j]));
    parent[b] = a; parent[find(c)] = a;
  }
  return new Set(parent.map((_, i) => find(i))).size;
};

test('254 source edge proportions retain the short shaft and chunky bifurcated forks', () => {
  const { geometry: g, blocks, sourceReference: { plate254: source } } = create({ id: 254 }).root.userData;
  const height = source.rasterWheelBodyBounds.bottom - source.rasterWheelBodyBounds.top;
  const width = source.rasterWheelBodyBounds.right - source.rasterWheelBodyBounds.left;
  const shaftWidth = source.rasterShaftBounds.right - source.rasterShaftBounds.left;
  assert.ok(Math.abs(g.wheelWidth / (2 * g.wheelBodyRadius) - width / height) < .01);
  assert.ok(Math.abs(g.shaftLength / (2 * g.wheelBodyRadius) - shaftWidth / height) < .01);
  for (const fork of blocks.forks) {
    // The actual flat Y plate: its axial width against each engraved fork,
    // its radial reach from inside the body out to the rounded tips, and a
    // chunky section (not wire rods) as thick tangentially as it is wide.
    const y = flatY(fork);
    y.geometry.computeBoundingBox();
    const box = y.geometry.boundingBox, forkWidth = box.max.x - box.min.x;
    assert.ok(Math.abs(forkWidth - 2 * (g.forkHalfSpread + g.forkBarRadius)) < 1e-3);
    for (const engraved of source.rasterForkProfiles) {
      assert.ok(Math.abs(forkWidth / (2 * g.wheelBodyRadius) - (engraved.right - engraved.left) / height) < .02,
        `fork width ${forkWidth} against engraved ${engraved.right - engraved.left} px`);
    }
    assert.ok(Math.abs(box.max.y - (g.forkTipRadius + g.forkBarRadius)) < 1e-3);
    assert.ok(box.min.y < g.wheelBodyRadius - .15, 'the stem starts well inside the body');
    const thickness = box.max.z - box.min.z;
    assert.ok(thickness >= 2 * g.forkBarRadius && thickness < 3 * g.forkBarRadius, `flat plate thickness ${thickness}`);
    assert.ok(2 * g.forkBarRadius > .25 * forkWidth, 'chunky prongs, about a quarter of the fork width');
  }
});

test('254 finite fork seat clears the prongs and a wider gauge intersects them', () => {
  const m = create({ id: 254 }), d = m.root.userData, g = d.geometry;
  m.root.updateMatrixWorld(true);
  assert.ok(g.chainSeatRadius > g.forkJunctionRadius && g.chainSeatRadius < g.forkTipRadius,
    'the seat lies between the junction and the prong tips');
  assert.ok(g.chainSeatHalfGap > .1, 'a centred link keeps more than 0.1 of half-width');
  for (const fork of d.blocks.forks) {
    const y = flatY(fork), field = solidSurface(y.geometry);
    const toPlate = y.matrixWorld.clone().invert().multiply(fork.matrixWorld);
    for (const side of [-1, 1]) for (const z of [-.09, 0, .09]) {
      // The seat gauge touches the actual flat prong on each side, through
      // the plate's whole tangential thickness.
      const seat = new THREE.Vector3(side * g.chainSeatHalfGap, g.chainSeatRadius, z).applyMatrix4(toPlate);
      const gap = field.signedDistance(seat);
      assert.ok(gap > -1e-6 && gap < .0012, `finite flat-prong gap ${gap}`);
      const oversized = new THREE.Vector3(side * (g.chainSeatHalfGap + .015), g.chainSeatRadius, z).applyMatrix4(toPlate);
      assert.ok(field.signedDistance(oversized) < -.005, 'oversized gauge must hit the real prong');
    }
    // The whole centred link section at the seat is clear of the fork.
    for (let i = 0; i <= 20; i++) {
      const point = new THREE.Vector3((i / 10 - 1) * (g.chainSeatHalfGap - .002), g.chainSeatRadius, 0).applyMatrix4(toPlate);
      assert.ok(field.signedDistance(point, .05) > 0, 'the seat is open between the prongs');
    }
  }
});

test('254 bored hub/body clear the shaft while every fork is one solid plate rooted in the wheel', () => {
  const m = create({ id: 254 }), b = m.root.userData.blocks, g = m.root.userData.geometry;
  m.root.updateMatrixWorld(true);
  for (const part of [b.hub, b.wheelBody]) {
    const field = solidSurface(part.geometry), transform = part.matrixWorld.clone().invert().multiply(b.shaft.matrixWorld);
    for (const p of surfacePoints(b.shaft.geometry)) {
      assert.ok(field.signedDistance(p.clone().applyMatrix4(transform), .005) > .004);
    }
  }
  const body = solidSurface(b.wheelBody.geometry), shaft = solidSurface(b.shaft.geometry);
  for (const fork of b.forks) {
    const y = flatY(fork);
    // (The authored white pocket index is stripped in production.)
    assert.equal(fork.children.filter(o => o.isMesh && o.visible && o.userData.role !== 'white-one-pocket-per-turn-index').length, 1,
      'no separate rods or balls');
    assert.equal(pieces(y.geometry), 1, 'stem and both prongs are one connected plate');
    const toBody = b.wheelBody.matrixWorld.clone().invert().multiply(y.matrixWorld);
    const toShaft = b.shaft.matrixWorld.clone().invert().multiply(y.matrixWorld);
    const points = surfacePoints(y.geometry);
    const depth = Math.min(...points.map(p => body.signedDistance(p.clone().applyMatrix4(toBody), .05)));
    assert.ok(depth < -.02 + 1e-6, `fork root is embedded in the wheel (${depth})`);
    // Every part of the plate outside the body is continuous with the root:
    // the stem crosses the body surface through the plate's full thickness.
    for (const z of [-.099, 0, .099]) {
      const crossing = new THREE.Vector3(0, g.wheelBodyRadius, z).applyMatrix4(y.matrixWorld.clone().invert().multiply(y.parent.matrixWorld));
      assert.ok(solidSurface(y.geometry).inside(crossing), 'the stem is solid where it leaves the body');
    }
    for (const p of points) assert.ok(shaft.signedDistance(p.clone().applyMatrix4(toShaft), .05) > 0, 'fork clears the shaft');
  }
  const index = b.shaftIndex.position;
  assert.ok(Math.hypot(index.y, index.z) + .045 < g.shaftRadius, 'face index fits entirely on the shaft');
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
