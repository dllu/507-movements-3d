import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredAnnularEscapementMovement as annular } from '../src/simulation/authored-annular-escapements.js';
import { createAuthoredStudEscapementMovement as stud } from '../src/simulation/authored-stud-escapements.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

for (const [id, make] of [[290, annular], [292, stud]]) {
  test(`${id}: corrected finite interfaces clear throughout the beat`, () => {
    const m = make({ id }), d = m.root.userData, g = d.geometry;
    const samples = new Map(), solids = new Map(), pairs = d.annularStudWorkingParts.pairs;
    for (const [a, b] of pairs) {
      if (!samples.has(a)) samples.set(a, surfacePoints(a.geometry));
      if (!solids.has(b)) solids.set(b, solidSurface(b.geometry));
    }
    const phases = [...Array.from({ length: 257 }, (_, i) => i / 256),
      ...[g.landingHalfPhase, g.releaseHalfPhase].flatMap(p => [p / 2 - 1e-6, p / 2 + 1e-6, .5 + p / 2 - 1e-6, .5 + p / 2 + 1e-6])];
    const point = new THREE.Vector3(); let minimum = .005, count = 0;
    for (const phase of phases) {
      m.update(g.pendulumPeriod * phase); m.root.updateMatrixWorld(true);
      for (const [a, b] of pairs) {
        const transform = b.matrixWorld.clone().invert().multiply(a.matrixWorld);
        for (const p of samples.get(a)) {
          const gap = solids.get(b).signedDistance(point.copy(p).applyMatrix4(transform), .005);
          minimum = Math.min(minimum, gap); count++;
          assert.ok(gap > -1e-5, `${id} at ${phase}: ${a.userData.role} / ${b.userData.role}: ${gap}`);
        }
      }
    }
    console.log({ id, count, minimum });
  });
}

test('290: both finite working faces stay close and oppose clockwise wheel torque', () => {
  const m = annular({ id: 290 }), d = m.root.userData, g = d.geometry;
  let maximumGap = 0, maximumReaction = -Infinity, count = 0;
  for (let i = 0; i <= 1024; i++) {
    const s = d.stateAtTime(g.pendulumPeriod * i / 1024);
    if (!s.contactActive) continue;
    const pallet = s.activeSide > 0 ? d.blocks.rightPallet : d.blocks.leftPallet;
    const point = s.activeToothPoint.clone().sub(g.suspensionPivot).rotateAround(new THREE.Vector2(), -s.pendulumAngle);
    let nearest, distance = Infinity;
    for (const polygon of pallet.userData.body.geometry.userData.plate.polygons) for (const ring of polygon) {
      for (let j = 0; j < ring.length - 1; j++) {
        const a = new THREE.Vector2(...ring[j]), v = new THREE.Vector2(...ring[j + 1]).sub(a);
        const q = a.clone().addScaledVector(v, THREE.MathUtils.clamp(point.clone().sub(a).dot(v) / v.lengthSq(), 0, 1));
        if (q.distanceTo(point) < distance) { distance = q.distanceTo(point); nearest = q; }
      }
    }
    const reaction = point.clone().sub(nearest).normalize().rotateAround(new THREE.Vector2(), s.pendulumAngle);
    const radius = s.activeToothPoint.clone().sub(g.wheelCenter);
    const forward = new THREE.Vector2(radius.y, -radius.x).normalize();
    const opposition = reaction.dot(forward);
    maximumGap = Math.max(maximumGap, distance); maximumReaction = Math.max(maximumReaction, opposition); count++;
    assert.ok(distance < .0002, `missing finite contact ${distance} at ${i}`);
    assert.ok(opposition < -.05, `reaction ${opposition} at ${i}`);
  }
  console.log({ count, maximumGap, maximumReaction });
});

test('292: all four spokes attach to both hub and rim, leaving the shaft passage open', () => {
  const m = stud({ id: 292 }), b = m.root.userData.blocks;
  m.root.updateMatrixWorld(true);
  const hub = solidSurface(b.wheelHub.geometry), rim = solidSurface(b.wheelRim.geometry);
  for (const spoke of b.spokeMeshes) {
    for (const [x, part, surface] of [[-1.32, b.wheelHub, hub], [1.32, b.wheelRim, rim]]) {
      const p = new THREE.Vector3(x, 0, 0).applyMatrix4(spoke.matrixWorld).applyMatrix4(part.matrixWorld.clone().invert());
      assert.ok(surface.inside(p), `spoke endpoint must attach to ${part.userData.role}`);
    }
  }
});

test('290: finite front bridges join each working pallet to the annulus', () => {
  const m = annular({ id: 290 }), b = m.root.userData.blocks;
  m.root.updateMatrixWorld(true);
  for (const [bridge, pallet] of [[b.leftConnector, b.leftPallet], [b.rightConnector, b.rightPallet]]) {
    const samples = surfacePoints(bridge.geometry);
    for (const part of [pallet.userData.body, b.annulus]) {
      const surface = solidSurface(part.geometry), transform = part.matrixWorld.clone().invert().multiply(bridge.matrixWorld);
      const gap = Math.min(...samples.map(p => surface.signedDistance(p.clone().applyMatrix4(transform), .02)));
      assert.ok(gap < -.001, `${bridge.userData.role} must join ${part.userData.role}: ${gap}`);
    }
  }
});

for (const [id, make] of [[290, annular], [292, stud]]) test(`${id}: stable geometry, visible-cycle fit and explicit qualification`, () => {
  const m = make({ id }), d = m.root.userData, resources = [];
  m.root.traverse(o => { if (o.geometry) resources.push([o, o.geometry, o.geometry.attributes.position.array]);
    for (const mat of [].concat(o.material ?? [])) assert.equal(mat.fog, false); });
  const point = new THREE.Vector3();
  // 292 deliberately crops the wheel to Brown's close-up; its pallets, arms,
  // F and the working rim arc must still lie inside the crop.
  const framed = id === 292
    ? [d.blocks.frontPallet.group ?? d.blocks.frontPallet, d.blocks.rearPallet.group ?? d.blocks.rearPallet, d.blocks.palletPivotHub]
    : [m.root];
  if (id === 292) assert.equal(d.cameraFitCropsSource, true);
  for (let i = 0; i <= 64; i++) {
    m.update(d.geometry.pendulumPeriod * i / 64); m.root.updateMatrixWorld(true);
    // Parts deliberately beyond the crop (290's rod K run-on and bob) are
    // flagged cameraFitExclude.
    for (const object of framed) object.traverseVisible(o => { const a = o.userData.cameraFitExclude ? null : o.geometry?.attributes.position; if (a) for (let j = 0; j < a.count; j++)
      assert.ok(d.cameraFitBounds.containsPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld)), `${id}: ${o.userData.role} framed`); });
  }
  for (const [o, geometry, array] of resources) { assert.equal(o.geometry, geometry); assert.equal(o.geometry.attributes.position.array, array); }
  assert.equal(d.hideGround, true); assert.equal(d.minimumDisplayCycleSeconds, 4);
  assert.match(d.reconstructionNote, id === 290 ? /prescribed.*idealized/ : /handoff cusp is relieved.*prescribed/);
});
