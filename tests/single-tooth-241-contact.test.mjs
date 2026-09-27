import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { solidSurface, surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';
const make = () => create({ id: 241 });
const at = (m, phase) => { const g = m.root.userData.geometry; m.update((phase - g.initialCycleCoordinate) * g.cyclePeriod); m.root.updateMatrixWorld(true); return m.root.userData.kinematics; };
const cross = (a, b) => a.x * b.y - a.y * b.x;
function contactNormals(mesh, target) {
  const p = target.clone().applyMatrix4(mesh.matrixWorld.clone().invert()), normals = [];
  for (const triangle of surfaceTriangles(mesh.geometry)) {
    if (triangle.closestPointToPoint(p, new THREE.Vector3()).distanceTo(p) > 2e-7) continue;
    const n = triangle.getNormal(new THREE.Vector3()).transformDirection(mesh.matrixWorld);
    if (Math.abs(n.z) < 1e-8 && !normals.some(v => v.distanceTo(n) < 1e-6)) normals.push(n);
  }
  return normals;
}
function assertCornerSupports(normals, direction) {
  assert.equal(normals.length, 2);
  const [a, b] = normals, determinant = cross(a, b);
  assert.ok(cross(direction, b) / determinant > 0);
  assert.ok(cross(a, direction) / determinant > 0);
}

test('241 actual driving and retaining surfaces provide the required clockwise normal reactions', () => {
  const m = make(), d = m.root.userData, b = d.blocks;
  let minDriveMoment = Infinity;
  for (let i = 0; i <= 64; i++) {
    const s = at(m, d.geometry.engagementFraction * i / 65);
    const p = new THREE.Vector3(s.driverContact.point.x, s.driverContact.point.y, 0.1);
    const normal = contactNormals(b.outputWheelBody, p).find(n => -cross(p, n) < -1);
    assert.ok(normal, 'actual radial tooth face exists at the reported contact');
    minDriveMoment = Math.min(minDriveMoment, cross(p, normal));
    assert.ok(-cross(p, normal) < -1.83, 'clockwise driving reaction');
    assertCornerSupports(contactNormals(b.driverTooth, p), normal.clone().negate());
    assert.ok(Math.abs(s.driverContact.normalVelocityError) < 1e-12);
  }
  for (const phase of [0.2, 0.5, 0.9, 1.5]) {
    const s = at(m, phase), p = new THREE.Vector3(s.holdingContact.point.x, s.holdingContact.point.y, 0.1);
    const normal = contactNormals(b.outputWheelBody, p).find(n => -cross(p, n) < -1);
    assert.ok(normal);
    // The click's rounded nose bears on the radial lock face just above
    // the root; the reaction's arm is the contact radius (about 1.7).
    assert.ok(Math.abs(cross(p, normal) - Math.hypot(p.x, p.y)) < 2e-6 && cross(p, normal) > 1.7, 'retaining face opposes counterclockwise backslip');
    const nose = s.holdingContact.noseCenter;
    assert.ok(Math.abs(Math.hypot(nose.x - p.x, nose.y - p.y) - d.geometry.holdingNoseRadius) < 1e-9, 'the nose circle touches the face');
    const along = new THREE.Vector2(p.x - nose.x, p.y - nose.y).normalize();
    assert.ok(along.x * normal.x + along.y * normal.y < -0.9999, 'nose normal opposes the face normal');
  }
  console.log({ minimumClockwiseDriverMomentMagnitude: minDriveMoment });
});

test('241 unexpanded finite curved bodies clear the actual wheel through engagement and full return', () => {
  const m = make(), d = m.root.userData, b = d.blocks, wheel = b.outputWheelBody;
  const field = solidSurface(wheel.geometry), parts = [b.driverTooth, b.holdingClickBody];
  const points = parts.map(p => surfacePoints(p.geometry));
  const phases = [...Array.from({length: 129}, (_, i) => i / 128), ...Array.from({length: 129}, (_, i) => d.geometry.engagementFraction * i / 128)];
  let minimum = Infinity;
  for (const phase of phases) {
    at(m, phase);
    for (const [j, part] of parts.entries()) {
      const matrix = wheel.matrixWorld.clone().invert().multiply(part.matrixWorld);
      for (const point of points[j]) {
        const gap = field.signedDistance(point.clone().applyMatrix4(matrix));
        minimum = Math.min(minimum, gap);
        assert.ok(gap > -1e-7, `${phase} ${part.userData.role}: ${gap}`);
      }
      const a = new THREE.Box3().setFromObject(part), w = new THREE.Box3().setFromObject(wheel);
      assert.ok(Math.min(a.max.z, w.max.z) - Math.max(a.min.z, w.min.z) > 0.0999);
    }
  }
  console.log({ minimumActualWorkingBodyClearance: minimum });
});

test('241 preserved one-tooth law has continuous positions and explicit ideal impact boundaries', () => {
  const m = make(), d = m.root.userData, e = d.geometry.engagementFraction, epsilon = 1e-10;
  for (const boundary of [0, e, 1, 1 + e, 19]) {
    const a = d.stateAtCycleCoordinate(boundary - epsilon), b = d.stateAtCycleCoordinate(boundary + epsilon);
    assert.ok(Math.abs(a.outputAngle - b.outputAngle) < 1e-8);
    assert.ok(Math.abs(a.holdingAngleDelta - b.holdingAngleDelta) < 2e-5);
    assert.ok(a.holdingContact.noseCenter.distanceTo(b.holdingContact.noseCenter) < 4e-5);
  }
  for (let i = 0; i < 19; i++) {
    const a = d.stateAtCycleCoordinate(i), b = d.stateAtCycleCoordinate(i + 1);
    assert.ok(Math.abs(b.outputAngle - a.outputAngle + d.geometry.outputPitch) < 1e-14);
    assert.ok(b.driverAngle > a.driverAngle && b.outputAngle < a.outputAngle);
  }
  assert.match(d.reconstructionNote, /ideal rigid impacts/);
  assert.match(d.contactQualification241.forceLimit, /singular click speed/);
});

test('241 finite hubs and holding-click eye have real shaft passages', () => {
  const m = make(), d = m.root.userData, b = d.blocks;
  const pairs = [[b.driverShaft.userData.rotor.children[0], b.driverDisk, 0.0029],
    [b.driverShaft.userData.rotor.children[0], d.workingParts241.driverHub, 0.0029],
    [b.holdingClickPivot.userData.rotor.children[0], b.holdingClickBody, 0.0049],
    [b.outputShaft.userData.rotor.children[0], b.outputWheel.userData.hub, 0.0019]];
  const cache = pairs.map(([pin, body, tolerance]) => ({ pin, body, tolerance, points: surfacePoints(pin.geometry), field: solidSurface(body.geometry) }));
  for (let i = 0; i <= 16; i++) {
    at(m, i / 16 * d.geometry.engagementFraction);
    for (const {pin, body, tolerance, points, field} of cache) {
      const transform = body.matrixWorld.clone().invert().multiply(pin.matrixWorld);
      for (const p of points) assert.ok(field.signedDistance(p.clone().applyMatrix4(transform)) > tolerance, `${pin.userData.role}: ${body.userData.role}`);
    }
  }
});

test('241 swept finite geometry fits, indicators attach, and playback retains buffers', () => {
  const m = make(), d = m.root.userData, b = d.blocks, meshes = [];
  m.root.traverse(o => { if(o.isMesh) meshes.push([o, o.geometry]); });
  const p = new THREE.Vector3();
  for (let i = 0; i <= 64; i++) {
    at(m, i / 64);
    for (const [o, geometry] of meshes) {
      assert.equal(o.geometry, geometry);
      assert.equal(o.material.fog, false);
      if (!o.visible) continue;
      for (let j = 0; j < geometry.attributes.position.count; j++) {
        p.fromBufferAttribute(geometry.attributes.position, j).applyMatrix4(o.matrixWorld);
        assert.ok(d.cameraFitBounds.containsPoint(p), `${o.userData.role}: ${p.toArray()}`);
      }
    }
  }
  const index = b.outputWheelIndicator; index.geometry.computeBoundingBox();
  assert.ok(index.position.y + index.geometry.boundingBox.max.y < d.geometry.outputRootRadius);
  assert.ok(Math.abs(index.position.z + index.geometry.boundingBox.min.z - d.geometry.outputDepth / 2) < 1e-8);
  assert.equal(d.minimumDisplayCycleSeconds, 8);
  assert.equal(d.hideGround, true);
  assert.equal(d.sourceAnimation.available, false);
  assert.match(d.sourceAnimation.reason, /no inline animation/);
  assert.match(d.reconstructionNote, /not dynamically solved/);
});
