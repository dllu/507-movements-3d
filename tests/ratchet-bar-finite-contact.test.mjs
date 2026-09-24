import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredRatchetBarMovement } from '../src/simulation/authored-ratchet-bars.js';
import { poly, polygonClipping } from '../src/simulation/finite-plate-geometry.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

const create = () => createAuthoredRatchetBarMovement({ id: 271 });
// The display loop opens at Brown's pose (phase 0.5) and drives on through
// phase 2 before the in-view return; phases 0..0.5 are taken from the second
// vibration, which has the same pose up to a whole two-pitch bar offset.
const at = (model, phase) => { model.update((phase < 0.5 ? phase + 0.5 : phase - 0.5) * 5); model.root.updateMatrixWorld(true); return model.root.userData.kinematics; };
const area = polygons => polygons.reduce((sum, polygon) => sum + polygon.reduce((s, ring) => s + Math.abs(ring.reduce((a, q, i) => {
  const v = ring[(i + 1) % ring.length]; return a + q[0] * v[1] - q[1] * v[0];
}, 0)) / 2, 0), 0);

function rackOutline(model) {
  const { blocks: b, geometry: g } = model.root.userData;
  const faces = b.rackTeeth.userData.driveFaces;
  const points = [[faces[0].root.x - g.rackPitch, g.toothRootY]];
  for (const face of faces) points.push(face.tip.toArray(), face.root.toArray());
  return poly(points.map(p => p.map(Math.fround)));
}
function renderedOutline(mesh, rack) {
  return mesh.geometry.userData.plate.polygons.map(p => p.map(ring => ring.map(q => {
    // plate() explicitly writes these float32 vertices to the extrusion.
    const v = new THREE.Vector3(Math.fround(q[0]), Math.fround(q[1]), 0).applyMatrix4(mesh.matrixWorld);
    return [v.x - rack.position.x, v.y];
  })));
}

test('271 finite hook and stepped shoulder clear every tooth on both complete strokes', () => {
  const model = create(), { blocks: b } = model.root.userData, teeth = rackOutline(model);
  let maximumArea = 0;
  for (let i = 0; i <= 512; i++) {
    at(model, i / 512);
    for (const pawl of [b.longPawl, b.shortPawl]) for (const name of ['hook', 'bridge']) {
      const overlap = area(polygonClipping.intersection(renderedOutline(pawl.userData[name], b.rack), teeth));
      maximumArea = Math.max(maximumArea, overlap);
      assert.ok(overlap < 1e-10, `${pawl.userData.role}/${name}, phase ${i / 512}, area ${overlap}`);
    }
  }
  assert.ok(maximumArea < 1e-10);
});

test('271 active finite surfaces share depth and drive the face with a seating reaction', () => {
  const model = create(), { blocks: b } = model.root.userData;
  const field = solidSurface(b.rackTeeth.geometry);
  let maximumGap = 0, minimumMoment = Infinity;
  for (const phase of [0.2, 0.3, 0.45, 0.7, 0.8, 0.95]) {
    const state = at(model, phase), pawl = state.longDriving ? b.longPawl : b.shortPawl;
    assert.ok(state.engaged);
    const hook = pawl.userData.hook;
    const relative = new THREE.Matrix4().copy(b.rackTeeth.matrixWorld).invert().multiply(hook.matrixWorld);
    const distances = surfacePoints(hook.geometry).map(point => field.signedDistance(point.applyMatrix4(relative)));
    const gap = Math.min(...distances);
    assert.ok(gap > -3e-7 && gap < 1.2e-5, `actual finite gap ${gap}`);
    maximumGap = Math.max(maximumGap, gap);
    const bounds = new THREE.Box3().setFromObject(hook), rackBounds = new THREE.Box3().setFromObject(b.rackTeeth);
    assert.ok(Math.min(bounds.max.z, rackBounds.max.z) - Math.max(bounds.min.z, rackBounds.min.z) > 0.1999);
    const anchor = state.longDriving ? state.longAnchor : state.shortAnchor;
    // The vertical tooth face has outward +X normal. Its reaction on the hook
    // gives +Z torque: the leftward hook rotates down into its seat.
    const moment = anchor.y - state.activeContactPoint.y;
    minimumMoment = Math.min(minimumMoment, moment);
    assert.ok(moment > 0.25);
    assert.ok(-state.barSpeed > 0, 'leftward contact force does positive work on the bar');
  }
  console.log({ maximumActiveSurfaceGap: maximumGap, minimumSeatingMomentPerUnitForce: minimumMoment });
});

test('271 pawl roots, lever and fixed bearing contain real shaft bores', () => {
  const model = create(), { blocks: b } = model.root.userData;
  for (const pawl of [b.longPawl, b.shortPawl]) {
    const field = solidSurface(pawl.userData.beam.geometry);
    for (let i = 0; i < 64; i++) {
      const a = 2 * Math.PI * i / 64, point = new THREE.Vector3(0.085 * Math.cos(a), 0.085 * Math.sin(a), 0);
      assert.ok(field.signedDistance(point) > 0.0018);
    }
    const beam = pawl.userData.beam.geometry.userData.plate;
    const leverFront = 0.82, leverBack = 0.62;
    assert.ok(pawl.position.z + beam.low >= leverFront + 0.0199 || pawl.position.z + beam.high <= leverBack - 0.0199);
  }
  const lever = b.leverBody.children[0], field = solidSurface(lever.geometry);
  for (const pin of b.leverPins) for (let i = 0; i < 32; i++) {
    const r = pin.userData.role === 'fixed-middle-fulcrum-pin' ? 0.13 : 0.085;
    const a = i * Math.PI / 16;
    assert.ok(field.signedDistance(new THREE.Vector3(pin.position.x + r * Math.cos(a), pin.position.y + r * Math.sin(a), 0)) > 0.0018);
  }
  const bearing = model.root.children.find(o => o.userData.role === 'bored-stationary-fulcrum-bearing');
  const fixedField = solidSurface(bearing.geometry);
  assert.ok(fixedField.signedDistance(new THREE.Vector3(0.13, 0, -0.1)) > 0.0038);
});

test('271 bar lies on the source table, clears the post, and carries no drawn markers', () => {
  const model = create(), { blocks: b } = model.root.userData;
  // Brown draws a plank table on two block legs, with no guide pedestals.
  assert.equal(b.guidePosts, undefined);
  assert.equal(b.baseRail, undefined);
  assert.equal(b.tableLegs.length, 2);
  for (const phase of [0, 0.25, 0.5, 0.75, 0.999999]) {
    at(model, phase);
    const body = new THREE.Box3().setFromObject(b.rackBody);
    const table = new THREE.Box3().setFromObject(b.table);
    const gap = body.min.y - table.max.y;
    assert.ok(gap > 0.0009 && gap < 0.0031, `bar rests on the table: ${gap}`);
    assert.ok(body.min.x > table.min.x - 0.6, 'bar stays over the table');
    for (const leg of b.tableLegs) {
      assert.ok(new THREE.Box3().setFromObject(leg).max.y <= table.min.y + 1e-9);
    }
    const stand = new THREE.Box3().setFromObject(b.pivotStand);
    assert.ok(stand.min.x - body.max.x > 0.0599);
    for (const marker of b.rackIndexes) assert.equal(marker.visible, false);
    // The cord's free span always reaches from the pulley to the bar end.
    const cord = new THREE.Box3().setFromObject(b.cordSpan);
    assert.ok(Math.abs(cord.max.x - body.min.x) < 1e-6);
  }
  // Over the whole display loop (two vibrations, then the in-view return)
  // the bar's left end stops well short of the pulley and its right end
  // never reaches the post.
  const { timeline, geometry: g } = model.root.userData;
  for (let i = 0; i <= 200; i++) {
    model.update(i * timeline.demonstrationPeriod / 200); model.root.updateMatrixWorld(true);
    const body = new THREE.Box3().setFromObject(b.rackBody);
    assert.ok(body.min.x > g.pulleyCenter.x + g.pulleyRadius + 0.15, `bar end clears the pulley at ${i}`);
    assert.ok(new THREE.Box3().setFromObject(b.pivotStand).min.x - body.max.x > 0.0599);
  }
});

test('271 has continuous rigid return paths and honest finite-pickup timing', () => {
  const model = create(), { stateAtCycleCoordinate: state, geometry: g } = model.root.userData;
  for (const phase of [0, 0.2, 0.4, 0.5, 0.7, 0.9, 1]) {
    const before = state(phase - 1e-7), after = state(phase + 1e-7);
    assert.ok(before.longTip.distanceTo(after.longTip) < 2e-6);
    assert.ok(before.shortTip.distanceTo(after.shortTip) < 2e-6);
    assert.ok(Math.abs(before.barDisplacement - after.barDisplacement) < 2e-6);
  }
  assert.ok(Math.abs(state(0.5).barDisplacement + g.rackPitch) < 1e-14);
  assert.ok(Math.abs(state(1).barDisplacement + 2 * g.rackPitch) < 1e-14);
  assert.equal(state(0).engaged, false);
  assert.equal(state(0.5).engaged, false);
  assert.equal(model.root.userData.minimumDisplayCycleSeconds, 12.5);
  assert.match(model.root.userData.reconstructionNote, /prescribed.*not solved/);
});

test('271 repeated state queries and updates preserve geometry, count and full-cycle framing', () => {
  const model = create(), snapshot = () => {
    const result = []; model.root.traverse(o => result.push([o, o.geometry])); return result;
  }, initial = snapshot(), point = new THREE.Vector3();
  for (let i = 0; i <= 64; i++) {
    model.root.userData.stateAtTime(i * 0.125);
    at(model, i / 64);
    model.root.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const vertices = o.geometry.attributes.position;
      for (let j = 0; j < vertices.count; j++) {
        point.fromBufferAttribute(vertices, j).applyMatrix4(o.matrixWorld);
        assert.ok(model.root.userData.cameraFitBounds.containsPoint(point), `${o.userData.role}: ${point.toArray()}`);
      }
    });
  }
  assert.deepEqual(snapshot(), initial);
});
