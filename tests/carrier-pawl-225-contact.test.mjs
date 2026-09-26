import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { nearest390Outline } from '../src/simulation/dual-band-pawl-contact.js';
import { carrierPawlBarClearance225 } from '../src/simulation/carrier-pawl-225-working-parts.js';
import { solidSurface, surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';
const make = () => create({ id: 225 });
const at = (model, phase) => { model.update((phase - 0.25) * 4); model.root.updateMatrixWorld(true); return model.root.userData.kinematics; };

test('225 real driving triangles have a useful positive normal moment through the drive', () => {
  const model = make(), d = model.root.userData, wheel = d.blocks.ratchet.userData.body;
  const triangles = surfaceTriangles(wheel.geometry), point = new THREE.Vector3(), nearest = new THREE.Vector3();
  let minimumMoment = Infinity, maximumGap = 0;
  for (let i = 0; i <= 32; i++) {
    const state = at(model, 0.499 * i / 32);
    const target = new THREE.Vector3(state.ratchetContactPoint.x, state.ratchetContactPoint.y, d.geometry.pawlPlaneZ).applyMatrix4(wheel.matrixWorld.clone().invert());
    let distance = Infinity, normal;
    for (const triangle of triangles) {
      triangle.closestPointToPoint(target, point);
      const value = point.distanceTo(target);
      if (value < distance) { distance = value; nearest.copy(point); normal = triangle.getNormal(new THREE.Vector3()); }
    }
    assert.ok(distance < 2e-7);
    normal.transformDirection(wheel.matrixWorld); nearest.applyMatrix4(wheel.matrixWorld);
    const moment = -(nearest.x * normal.y - nearest.y * normal.x);
    minimumMoment = Math.min(minimumMoment, moment);
    assert.ok(moment > 1.39, `finite face moment ${moment}`);
    assert.ok(normal.dot(new THREE.Vector3(state.contactNormal.x, state.contactNormal.y, 0)) > 0.999999);
    maximumGap = Math.max(maximumGap, state.pawlContactError);
    assert.ok(state.pawlToothNormalVelocityError < 1e-15);
  }
  console.log({ minimumActualFaceMoment: minimumMoment, maximumNominalRunningGap: maximumGap });
});

test('225 complete circular nose clears every actual outline edge through return and continuous drop', () => {
  const model = make(), d = model.root.userData, g = d.geometry;
  // Extrusion side-wall vertices use float32 coordinates; the enclosing full
  // circle is stronger than sampling only the inscribed cylinder vertices.
  const outline = d.blocks.ratchet.userData.profilePoints.map(p => p.toArray().map(Math.fround));
  let min = Infinity, largestDriveGap = 0;
  for (let i = 0; i <= 1024; i++) {
    const s = d.stateAtCycleCoordinate(i / 1024), a = -s.wheelAngle, c = Math.cos(a), sn = Math.sin(a), p = s.pawlContactCenter;
    const result = nearest390Outline([c * p.x - sn * p.y, sn * p.x + c * p.y], outline);
    const gap = result.distance - g.pawlNoseRadius;
    min = Math.min(min, gap);
    assert.ok(gap > 0.00019, `phase ${i / 1024}: ${gap}`);
    if (s.driving) { largestDriveGap = Math.max(largestDriveGap, gap); assert.ok(gap < 0.00021); }
  }
  console.log({ minimumFullCircleClearance: min, largestDriveGap });
  for (const phase of [0, 0.5, 1]) {
    const before = d.stateAtCycleCoordinate(phase - 1e-7), after = d.stateAtCycleCoordinate(phase + 1e-7);
    assert.ok(before.pawlContactCenter.distanceTo(after.pawlContactCenter) < 2e-6);
    assert.ok(Math.abs(before.pawlAngularSpeed - after.pawlAngularSpeed) < 2e-6);
    assert.ok(Math.abs(before.wheelAngle - after.wheelAngle) < 1e-12);
  }
});

test('225 flat pawl shares the wheel plane and its whole outline, not a cross-pin, meets the teeth', () => {
  const model = make(), d = model.root.userData, b = d.blocks, g = d.geometry, wheel = b.ratchet.userData.body;
  const outline = b.ratchet.userData.profilePoints.map(p => p.toArray());
  let minimum = Infinity, largestDriveGap = 0;
  for (let i = 0; i <= 256; i++) {
    const s = at(model, i / 256);
    const gap = carrierPawlBarClearance225(s.pawlPivot, s.pawlAngle, s.wheelAngle, g.pawlOutline, outline);
    minimum = Math.min(minimum, gap);
    assert.ok(gap > 0.00018, `${i / 256}: ${gap}`);
    // The 16-segment polygonal nose sits up to 0.00043 inside its circle.
    if (s.driving) { largestDriveGap = Math.max(largestDriveGap, gap); assert.ok(gap < 0.0007); }
    const pawlBox = new THREE.Box3().setFromObject(b.pawlBody), wheelBox = new THREE.Box3().setFromObject(wheel);
    assert.ok(pawlBox.min.z > wheelBox.min.z && pawlBox.max.z < wheelBox.max.z, 'pawl inside the tooth band');
  }
  assert.equal(b.pawlNose.isMesh, undefined, 'the nose is the pawl\'s own rounded end');
  let meshes = 0;
  b.pawl.traverse(o => { if (o.isMesh && o.visible) meshes += 1; });
  assert.equal(meshes, 1);
  console.log({ minimumWholeOutlineClearance: minimum, largestDriveGap });
});

test('225 separate pawl and carrier hinge bores clear their actual shafts', () => {
  const model = make(), d = model.root.userData, b = d.blocks, w = d.workingParts225;
  const cases = [[b.pawlBody.geometry, [0], 0.07, 0.0038], [w.carrier.geometry, [0, d.geometry.carrierLength], 0.07, 0.0038], [b.bottomBearing.geometry, [0], 0.07, 0.0038], [b.ratchet.userData.hub.geometry, [0], 0.105, 0.0029]];
  for (const [geometry, xs, radius, expectedGap] of cases) {
    const field = solidSurface(geometry);
    for (const x of xs) for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16;
      assert.ok(field.signedDistance(new THREE.Vector3(x + radius * Math.cos(angle), radius * Math.sin(angle), 0)) > expectedGap);
    }
  }
  for (const phase of [0, 0.25, 0.5, 0.75]) {
    const s = at(model, phase), hinge = w.hinge.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(hinge.x - s.pawlPivot.x, hinge.y - s.pawlPivot.y) < 1e-12);
    const carrier = new THREE.Box3().setFromObject(w.carrier), pawl = new THREE.Box3().setFromObject(b.pawlBody);
    assert.ok(carrier.min.z - pawl.max.z > 0.0949);
  }
});

test('225 actual full-cycle geometry fits and updates preserve all meshes', () => {
  const model = make(), d = model.root.userData, snapshot = () => { const values = []; model.root.traverse(o => values.push([o, o.geometry])); return values; }, before = snapshot(), point = new THREE.Vector3();
  for (let i = 0; i <= 64; i++) {
    at(model, i / 64);
    d.stateAtTime(i * 0.03);
    model.root.traverse(o => { if (!o.isMesh || !o.visible) return;
      assert.equal(o.material.fog, false);
      for (let j = 0; j < o.geometry.attributes.position.count; j++) {
        point.fromBufferAttribute(o.geometry.attributes.position, j).applyMatrix4(o.matrixWorld);
        assert.ok(d.cameraFitBounds.containsPoint(point), `${o.userData.role}: ${point.toArray()}`);
      }
    });
  }
  assert.deepEqual(snapshot(), before);
  assert.equal(d.minimumDisplayCycleSeconds, 4);
  assert.match(d.reconstructionNote, /held during return/);
  assert.match(d.reconstructionNote, /not dynamically solved/);
});

test('225 deterministic curved plate has one continuous finite body and a retained hinge bore', () => {
  const model = make(), d = model.root.userData, geometry = d.blocks.pawlBody.geometry;
  const polygons = geometry.userData.plate.polygons;
  assert.equal(polygons.length, 1);
  assert.equal(polygons[0].length, 2);
  const field = solidSurface(geometry), length = d.geometry.pawlLength;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(length * 0.45, -0.2, 0), new THREE.Vector3(length * 0.8, -0.28, 0), new THREE.Vector3(length, 0, 0)]);
  for (let i = 2; i <= 24; i++) {
    const center = curve.getPoint(i / 24);
    assert.ok(field.signedDistance(center) < -0.025, `finite curved body at ${i / 24}`);
  }
  assert.ok(field.signedDistance(new THREE.Vector3()) > 0.073);
  const outline = polygons[0][0], cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < outline.length; i++) for (let j = i + 2; j < outline.length; j++) {
    if (i === 0 && j === outline.length - 1) continue;
    const a = outline[i], b = outline[(i + 1) % outline.length], c = outline[j], e = outline[(j + 1) % outline.length];
    assert.ok(!(cross(a, b, c) * cross(a, b, e) < 0 && cross(c, e, a) * cross(c, e, b) < 0), `perimeter edges ${i}/${j}`);
  }
});
