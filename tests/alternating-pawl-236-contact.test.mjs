import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { nearest390Outline } from '../src/simulation/dual-band-pawl-contact.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';
const make = () => create({ id: 236 });
const at = (m, phase) => { m.update((phase - m.root.userData.geometry.initialCyclePhase) * 4); m.root.updateMatrixWorld(true); return m.root.userData.kinematics; };
const cross = (a, b) => a.x * b.y - a.y * b.x;

// Each driving toe is seated in its root: it touches the steep face and the
// previous tooth's back of the actual outline, and drives along the face
// normal with positive torque.
test('236 both strokes drive from a toe seated in the root with positive normal torque', () => {
  const m = make(), d = m.root.userData, g = d.geometry, outline = d.blocks.ratchet.userData.profilePoints;
  const segment = (p, a, b) => { const ab = b.clone().sub(a); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  let minTorque = Infinity, maxGap = 0, engaged = 0;
  for (let i = 0; i <= 64; i++) {
    const s = at(m, i / 64);
    if (!s.engaged) continue;
    engaged += 1;
    const c = s.activeContactCenter.clone().rotateAround(new THREE.Vector2(), -s.wheelAngle);
    let root = 0;
    for (let k = 0; k < outline.length; k += outline.length / 15) if (outline[k].distanceTo(c) < outline[root].distanceTo(c)) root = k;
    const face = segment(c, outline[root], outline[root + 1]) - g.pawlNoseRadius;
    const back = segment(c, outline[(root - 1 + outline.length) % outline.length], outline[root]) - g.pawlNoseRadius;
    assert.ok(Math.abs(face) < 1e-9 && Math.abs(back) < 1e-9, `seated: face ${face} back ${back}`);
    const moment = -cross(s.activeProfilePoint, s.activeContactNormal);
    minTorque = Math.min(minTorque, moment);
    assert.ok(moment > 1);
    assert.ok(Math.abs(moment - s.activeCompressionTorque) < 1e-12);
    // The toe is the flat pawl's own rounded end.
    const target = new THREE.Vector3(s.activeProfilePoint.x, s.activeProfilePoint.y, d.blocks.ratchet.position.z);
    const body = s.longDriving ? d.blocks.longPawlBody : d.blocks.shortPawlBody;
    const field = solidSurface(body.geometry), point = target.clone().applyMatrix4(body.matrixWorld.clone().invert());
    const gap = field.distance(point); maxGap = Math.max(maxGap, gap);
    assert.ok(gap < 0.00015, `finite inscribed toe gap ${gap}`);
  }
  assert.ok(engaged > 30);
  console.log({ minimumSeatedMoment: minTorque, maximumFiniteToeGap: maxGap });
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
    // A returning toe may still be sliding into its root as the lever reverses.
    for (const key of ['longTipCenter', 'shortTipCenter']) assert.ok(a[key].distanceTo(b[key]) < 4e-6);
    assert.ok(Math.abs(a.wheelAngularSpeed - b.wheelAngularSpeed) < 3e-6);
    // Returning pawls' speeds are the slopes of their tracked tables.
    for (const key of ['longPawlAngularSpeed', 'shortPawlAngularSpeed']) assert.ok(Math.abs(a[key] - b[key]) < 5e-5);
    assert.ok(Math.abs(a.wheelAngle - b.wheelAngle) < 1e-11);
  }
  console.log({ minimumEnclosingCircleClearance: minimum });
});

test('236 flat pawls lie in the wheel plane and selected moving solids clear through the cycle', () => {
  const m = make(), b = m.root.userData.blocks, wheel = b.ratchet.userData.body;
  assert.equal(b.longPawlContactFinger.isMesh, undefined);
  assert.equal(b.shortPawlContactFinger.isMesh, undefined);
  const pairs = [[b.longPawlBody, wheel], [b.shortPawlBody, wheel], [wheel, b.longPawlBody], [wheel, b.shortPawlBody],
    [b.longPawlBody, b.shortPawlBody], [b.longPawlPivotHub, b.leverBody], [b.shortPawlPivotHub, b.leverBody]];
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
    for (const body of [b.longPawlBody, b.shortPawlBody]) {
      const pawl = new THREE.Box3().setFromObject(body), w = new THREE.Box3().setFromObject(wheel);
      assert.ok(pawl.min.z > w.min.z && pawl.max.z < w.max.z, 'pawl inside the tooth band');
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
