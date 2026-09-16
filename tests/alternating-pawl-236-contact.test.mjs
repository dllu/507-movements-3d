import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { nearest390Outline } from '../src/simulation/dual-band-pawl-contact.js';
import { solidSurface, surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';
const make = () => create({ id: 236 });
const at = (m, phase) => { m.update((phase - m.root.userData.geometry.initialCyclePhase) * 4); m.root.updateMatrixWorld(true); return m.root.userData.kinematics; };
const cross = (a, b) => a.x * b.y - a.y * b.x;

// Check the normal cone of the actual two side faces meeting at the corner,
// not the old rod-direction surrogate for torque.
test('236 both strokes touch an actual tooth corner with positive normal torque', () => {
  const m = make(), d = m.root.userData, wheel = d.blocks.ratchet.userData.body;
  const triangles = surfaceTriangles(wheel.geometry);
  let minTorque = Infinity, maxGap = 0;
  for (let i = 0; i <= 64; i++) {
    const s = at(m, i / 64), target = new THREE.Vector3(s.activeProfilePoint.x, s.activeProfilePoint.y, 0);
    const local = target.clone().applyMatrix4(wheel.matrixWorld.clone().invert());
    const normals = [];
    for (const triangle of triangles) {
      const q = triangle.closestPointToPoint(local, new THREE.Vector3());
      if (q.distanceTo(local) < 2e-7) {
        const normal = triangle.getNormal(new THREE.Vector3()).transformDirection(wheel.matrixWorld);
        if (Math.abs(normal.z) < 1e-8 && !normals.some(n => n.distanceTo(normal) < 1e-6)) normals.push(normal);
      }
    }
    assert.equal(normals.length, 2);
    const n = s.activeContactNormal, [a, b] = normals, determinant = cross(a, b);
    assert.ok(cross(n, b) / determinant > 0 && cross(a, n) / determinant > 0, 'force is in actual convex corner normal cone');
    const moment = -cross(s.activeProfilePoint, n);
    minTorque = Math.min(minTorque, moment);
    assert.ok(moment > 0.28130);
    assert.ok(Math.abs(moment - s.activeCompressionTorque) < 1e-12);
    const finger = s.longDriving ? d.blocks.longPawlContactFinger : d.blocks.shortPawlContactFinger;
    const field = solidSurface(finger.geometry), point = target.clone().applyMatrix4(finger.matrixWorld.clone().invert());
    const gap = field.distance(point); maxGap = Math.max(maxGap, gap);
    assert.ok(gap < 0.0000061, `finite inscribed toe gap ${gap}`);
  }
  console.log({ minimumActualCornerMoment: minTorque, maximumFiniteToeGap: maxGap });
});

test('236 complete nose circles clear every float32 tooth edge and reseat continuously', () => {
  const m = make(), d = m.root.userData, outline = d.blocks.ratchet.userData.profilePoints.map(p => p.toArray().map(Math.fround));
  let minimum = Infinity;
  for (let i = 0; i <= 4096; i++) {
    const s = d.stateAtCycleCoordinate(2 * i / 4096), c = Math.cos(s.wheelAngle), sn = Math.sin(s.wheelAngle);
    for (const p of [s.longTipCenter, s.shortTipCenter]) {
      const gap = nearest390Outline([c * p.x + sn * p.y, -sn * p.x + c * p.y], outline).distance - d.geometry.pawlNoseRadius;
      minimum = Math.min(minimum, gap); assert.ok(gap > -1e-7, `${i}: ${gap}`);
    }
  }
  for (const phase of [0, 0.5, 1, 1.5, 15]) {
    const a = d.stateAtCycleCoordinate(phase - 1e-7), b = d.stateAtCycleCoordinate(phase + 1e-7);
    for (const key of ['longTipCenter', 'shortTipCenter']) assert.ok(a[key].distanceTo(b[key]) < 2e-6);
    for (const key of ['longPawlAngularSpeed', 'shortPawlAngularSpeed', 'wheelAngularSpeed']) assert.ok(Math.abs(a[key] - b[key]) < 3e-6);
    assert.ok(Math.abs(a.wheelAngle - b.wheelAngle) < 1e-11);
  }
  console.log({ minimumEnclosingCircleClearance: minimum });
});

test('236 actual toes occupy the wheel depth and selected moving solids clear through the cycle', () => {
  const m = make(), b = m.root.userData.blocks, wheel = b.ratchet.userData.body;
  const pairs = [[b.longPawlContactFinger, wheel], [b.shortPawlContactFinger, wheel], [b.longPawlBody, wheel], [b.shortPawlBody, wheel],
    [b.longPawlBody, b.shortPawlBody], [b.longPawlContactFinger, b.shortPawlBody], [b.shortPawlContactFinger, b.longPawlBody], [b.longPawlPivotHub, b.leverBody], [b.shortPawlPivotHub, b.leverBody]];
  const caches = pairs.map(([moving, fixed]) => ({ moving, fixed, points: surfacePoints(moving.geometry), field: solidSurface(fixed.geometry) }));
  let min = Infinity;
  for (let i = 0; i <= 64; i++) {
    at(m, i / 64);
    for (const { moving, fixed, points, field } of caches) {
      const transform = fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld);
      for (const p of points) {
        const gap = field.signedDistance(p.clone().applyMatrix4(transform)); min = Math.min(min, gap);
        assert.ok(gap > -1e-7, `${i / 64} ${moving.userData.role} vs ${fixed.userData.role}: ${gap}`);
      }
    }
    for (const finger of [b.longPawlContactFinger, b.shortPawlContactFinger]) {
      const toe = new THREE.Box3().setFromObject(finger), w = new THREE.Box3().setFromObject(wheel);
      assert.ok(Math.min(toe.max.z, w.max.z) - Math.max(toe.min.z, w.min.z) > 0.2299);
    }
  }
  console.log({ minimumSelectedSurfaceClearance: min });
});

test('236 actual pivot passages clear the finite pins and independently moving eyes', () => {
  const m = make(), d = m.root.userData, b = d.blocks;
  const pins = d.workingParts236.pins;
  const pairs = [];
  for (const [j, pawl] of [b.longPawl, b.shortPawl].entries()) {
    for (const target of [pawl.userData.body, pawl.userData.pivotHub, b.leverBody, b.leverJoints[j * 2].children[0]]) pairs.push([pins[j], target]);
  }
  const fixedPin = b.fulcrumShaft.userData.rotor.children[0];
  pairs.push([fixedPin, b.leverBody], [fixedPin, b.leverJoints[1].children[0]]);
  const cache = pairs.map(([pin, target]) => ({pin, target, points: surfacePoints(pin.geometry), field: solidSurface(target.geometry)}));
  for (let i = 0; i <= 16; i++) {
    at(m, i / 16);
    for (const {pin, target, points, field} of cache) {
      const transform = target.matrixWorld.clone().invert().multiply(pin.matrixWorld);
      for (const p of points) assert.ok(field.signedDistance(p.clone().applyMatrix4(transform)) > 0.0058, `${pin.userData.role} / ${target.userData.role}`);
    }
  }
});

test('236 retains buffers, readable timing, source evidence and explicit force qualifications', () => {
  const m = make(), d = m.root.userData, geometries = [];
  m.root.traverse(o => { if(o.isMesh) geometries.push([o, o.geometry]); });
  const bounds = d.cameraFitBounds, point = new THREE.Vector3();
  for (let i = 0; i <= 64; i++) {
    at(m, i / 64);
    for (const [o, geometry] of geometries) {
      assert.equal(o.geometry, geometry);
      assert.equal(o.material.fog, false);
      if (!o.visible) continue;
      for (let j = 0; j < geometry.attributes.position.count; j++) {
        point.fromBufferAttribute(geometry.attributes.position, j).applyMatrix4(o.matrixWorld);
        assert.ok(bounds.containsPoint(point), `${o.userData.role}: ${point.toArray()}`);
      }
    }
  }
  assert.equal(d.minimumDisplayCycleSeconds, 6);
  assert.equal(d.hideGround, true);
  assert.equal(d.sourceAnimation.available, false);
  assert.match(d.sourceAnimation.reason, /no inline animation/);
  assert.match(d.reconstructionNote, /prescribed/);
  assert.match(d.reconstructionNote, /not dynamically solved/);
});
