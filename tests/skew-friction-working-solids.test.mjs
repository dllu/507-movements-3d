import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createMovementModel } from '../src/simulation/registry.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
const catalog = JSON.parse(readFileSync(new URL('../src/data/movements.json', import.meta.url)));
const model = createMovementModel(catalog.movements[203]);
const { root } = model, b = root.userData.blocks, g = root.userData.geometry;
const cycle = root.userData.transmission.inputCyclePeriod;
const bodies = [b.driverBody, b.drivenBody];
const solids = bodies.map(mesh => solidSurface(mesh.geometry));
const triangles = bodies.map(mesh => surfaceTriangles(mesh.geometry));
const near = (mesh, faces, world) => {
  const local = mesh.worldToLocal(world.clone()), p = new THREE.Vector3();
  let best = Infinity, point, normal;
  for (const triangle of faces) {
    triangle.closestPointToPoint(local, p);
    const d = p.distanceToSquared(local);
    if (d < best) { best = d; point = p.clone(); normal = triangle.getNormal(new THREE.Vector3()); }
  }
  return { point: mesh.localToWorld(point), normal: normal.transformDirection(mesh.matrixWorld), distance: Math.sqrt(best) };
};

test('204 actual closed facets remain near opposed contact through rotation, with explicit sliding', () => {
  let maxGap = 0, maxNormalVelocity = 0, minOpposition = 1;
  for (let pose = 0; pose <= 16; pose++) {
    model.update(cycle * pose / 16); root.updateMatrixWorld(true);
    for (let station = -8; station <= 8; station++) {
      const point = new THREE.Vector3(g.contactHalfLength * station / 9, 0, 0);
      const [a, c] = bodies.map((mesh, i) => near(mesh, triangles[i], point));
      const gap = a.point.distanceTo(c.point);
      maxGap = Math.max(maxGap, gap);
      minOpposition = Math.min(minOpposition, -a.normal.dot(c.normal));
      assert.ok(gap < 0.002, `actual closest surface pair gap ${gap}`);
      assert.ok(a.normal.dot(c.normal) < -0.994, 'actual triangle normals oppose');
      const va = g.driverAxis.clone().multiplyScalar(1.08).cross(a.point.clone().sub(g.driverOrigin));
      const vc = g.drivenAxis.clone().multiplyScalar(root.userData.transmission.drivenAngularSpeed).cross(c.point.clone().sub(g.drivenOrigin));
      const relative = va.sub(vc);
      maxNormalVelocity = Math.max(maxNormalVelocity, Math.abs(relative.dot(a.normal)));
      // Facet normals deviate about 1.1 degrees; the bound is 2% of the 0.74 sliding speed.
      const sliding = root.userData.transmission.nominalLongitudinalSlidingSpeed;
      assert.ok(Math.abs(relative.dot(a.normal)) < 0.02 * sliding, `facet normal velocity ${relative.dot(a.normal)}`);
      assert.ok(Math.abs(Math.abs(relative.x) - sliding) < 0.004, `sliding ${relative.x} vs ${sliding}`);
      assert.ok(Math.hypot(relative.y, relative.z) < 0.003);
      // Transverse friction can oppose the input and drive the output. Normal
      // pressure alone supplies no ideal shaft torque; no preload is solved.
      const traction = new THREE.Vector3(0, 0, 1);
      const inputMoment = a.point.clone().sub(g.driverOrigin).cross(traction).dot(g.driverAxis);
      const outputMoment = c.point.clone().sub(g.drivenOrigin).cross(traction.negate()).dot(g.drivenAxis);
      assert.ok(inputMoment < 0 && outputMoment < 0); // input resists +omega; output drives -omega
    }
  }
  console.log(JSON.stringify({ maxGap, minOpposition, maxNormalVelocity }));
});

test('204 actual body/end hardware has no sampled cross-wheel penetration over a turn', () => {
  const hardware = [
    [b.driverBody, ...b.driverEndCaps, ...b.driverEndHubs, ...b.driverEndRims],
    [b.drivenBody, ...b.drivenEndCaps, ...b.drivenEndHubs, ...b.drivenEndRims],
  ];
  const points = new Map(hardware.flat().map(mesh => [mesh, surfacePoints(mesh.geometry)]));
  let minimum = Infinity, queries = 0;
  for (let pose = 0; pose <= 16; pose++) {
    model.update(cycle * pose / 16); root.updateMatrixWorld(true);
    for (let side = 0; side < 2; side++) {
      const target = bodies[1 - side], solid = solids[1 - side];
      const transform = target.matrixWorld.clone().invert();
      for (const mesh of hardware[side]) {
        const matrix = transform.clone().multiply(mesh.matrixWorld);
        for (const point of points.get(mesh)) {
          const p = point.clone().applyMatrix4(matrix);
          if (solid.box.distanceToPoint(p) > 0.004) continue;
          const d = solid.signedDistance(p, 0.004); queries++;
          minimum = Math.min(minimum, d);
          assert.ok(d > -1e-6, `cross-wheel intrusion ${d}, ${mesh.userData.role}, pose ${pose}`);
        }
      }
    }
  }
  // End rings/caps must also clear the opposing end hardware beyond the
  // nominal body's axial extent; checking only the body would miss that.
  const endSolids = new Map(hardware.flat().filter(mesh => !bodies.includes(mesh))
    .map(mesh => [mesh, solidSurface(mesh.geometry)]));
  for (let pose = 0; pose <= 16; pose++) {
    model.update(cycle * pose / 16); root.updateMatrixWorld(true);
    for (let side = 0; side < 2; side++) for (const target of hardware[1 - side].slice(1)) {
      const solid = endSolids.get(target), inverse = target.matrixWorld.clone().invert();
      for (const mesh of hardware[side].slice(1)) {
        const matrix = inverse.clone().multiply(mesh.matrixWorld);
        for (const point of points.get(mesh)) {
          const p = point.clone().applyMatrix4(matrix);
          if (solid.box.distanceToPoint(p) > 0.004) continue;
          const d = solid.signedDistance(p, 0.004); queries++;
          minimum = Math.min(minimum, d);
          assert.ok(d > -1e-6, `end hardware intrusion ${d}`);
        }
      }
    }
  }
  console.log(JSON.stringify({ minimum, queries }));
});

test('204 body/caps/hubs have real shaft bores; bearing posts clear the shafts', () => {
  model.update(0); root.updateMatrixWorld(true);
  for (const mesh of [...bodies, ...b.driverEndCaps, ...b.drivenEndCaps, ...b.driverEndHubs, ...b.drivenEndHubs]) {
    const solid = solidSurface(mesh.geometry);
    assert.equal(mesh.geometry.userData.boreRadius, 0.099);
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12;
      const point = mesh === b.driverBody || mesh === b.drivenBody
        ? new THREE.Vector3(0.095 * Math.cos(a), 0.095 * Math.sin(a), 0)
        : new THREE.Vector3(0.095 * Math.cos(a), 0, 0.095 * Math.sin(a));
      assert.ok(solid.signedDistance(point) > 0.0037);
    }
  }
  for (let i = 0; i < b.bearingPosts.length; i++) {
    const post = b.bearingPosts[i], center = b.bearingRings[i].position;
    post.traverse(mesh => {
      if (!mesh.isMesh) return;
      const solid = solidSurface(mesh.geometry);
      for (let a = 0; a < 24; a++) {
        const radial = new THREE.Vector3(0.095 * Math.cos(a * Math.PI / 12), 0.095 * Math.sin(a * Math.PI / 12), 0)
          .applyQuaternion(b.bearingRings[i].quaternion);
        const point = center.clone().add(radial);
        assert.ok(solid.signedDistance(mesh.worldToLocal(point)) > 0);
      }
    });
  }
});

test('204 visible indexes are flush end inlays, diagnostics hidden, and buffers stable', () => {
  for (const mesh of [b.driverMaterialStripe, b.drivenMaterialStripe, b.contactLine, ...b.contactMarkers]) assert.equal(mesh.visible, false);
  for (const index of [...b.driverEndFaceIndexes, ...b.drivenEndFaceIndexes]) {
    assert.equal(index.userData.flushInlay, true);
    assert.equal(index.geometry.type, 'PlaneGeometry');
    assert.ok(Math.abs(Math.abs(index.position.z) - 3.285) < 1e-12);
    assert.ok(index.position.length() > 3.285);
  }
  const objects = [], attributes = [];
  root.traverse(o => { objects.push(o); if (o.geometry) attributes.push(o.geometry.attributes.position); });
  for (let i = 0; i <= 32; i++) model.update(cycle * i / 32);
  const after = [], afterAttributes = [];
  root.traverse(o => { after.push(o); if (o.geometry) afterAttributes.push(o.geometry.attributes.position);
    for (const m of [o.material].flat().filter(Boolean)) assert.equal(m.fog, false);
    if (o.isMesh) assert.equal(o.castShadow, true);
  });
  assert.deepEqual(after, objects); assert.deepEqual(afterAttributes, attributes);
  assert.equal(root.userData.hideGround, true);
  assert.equal(root.userData.finiteFriction.validatedDynamics, false);
  assert.equal(root.userData.minimumDisplayCycleSeconds, g.closureCyclePeriod);
});
