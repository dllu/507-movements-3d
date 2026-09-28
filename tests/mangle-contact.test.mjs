import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function polygonIndex(points) {
  const bins = new Map();
  const edges = points.map((a, i) => ({ a, b: points[(i + 1) % points.length] }));
  for (const edge of edges) {
    for (let bin = Math.floor(Math.min(edge.a.y, edge.b.y) / 0.01);
      bin <= Math.floor(Math.max(edge.a.y, edge.b.y) / 0.01); bin += 1) {
      if (!bins.has(bin)) bins.set(bin, []);
      bins.get(bin).push(edge);
    }
  }
  return (p) => {
    let inside = false;
    let distance = Infinity;
    const bin = Math.floor(p.y / 0.01);
    for (const { a, b } of bins.get(bin) ?? []) {
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    for (let neighbor = bin - 1; neighbor <= bin + 1; neighbor += 1) {
      for (const { a, b } of bins.get(neighbor) ?? []) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const f = THREE.MathUtils.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
        distance = Math.min(distance, Math.hypot(p.x - a.x - f * dx, p.y - a.y - f * dy));
      }
    }
    return { inside, distance };
  };
}

function polarGap(p, outline) {
  const n = outline.length;
  const angle = THREE.MathUtils.euclideanModulo(Math.atan2(p.y, p.x), 2 * Math.PI);
  const i = Math.min(n - 1, Math.floor(angle * n / (2 * Math.PI)));
  const a = outline[i];
  const b = outline[(i + 1) % n];
  const length = Math.hypot(p.x, p.y);
  const radius = (a.x * b.y - a.y * b.x)
    / ((p.x * (b.y - a.y) - p.y * (b.x - a.x)) / length);
  return length - radius;
}

test('036 generated teeth clear and engage on both circular runs and both reversals', () => {
  const model = createMovementModel(catalog.movements[35]);
  const { pinion, toothStrip } = model.root.userData.blocks;
  const geometry = model.root.userData.geometry;
  const stripOutline = toothStrip.geometry.parameters.shapes.getPoints().slice(0, -1);
  const pinionMesh = pinion.userData.rotor.children.find((p) => p.userData.rackGeneratedGear);
  const pinionOutline = pinionMesh.geometry.parameters.shapes.getPoints().slice(0, -1);
  const stripQuery = polygonIndex(stripOutline);
  const radius = Math.max(...pinionOutline.map((p) => p.length()));
  let largestGap = 0;
  const branches = new Set();
  for (let pose = 0; pose < 256; pose += 1) {
    model.update(geometry.cycleDuration * (pose + 0.173) / 256, 0);
    model.root.updateMatrixWorld(true);
    const transform = pinionMesh.matrixWorld.clone().invert().multiply(toothStrip.matrixWorld);
    const inverse = transform.clone().invert();
    branches.add(model.root.userData.kinematics.branch);
    let gap = Infinity;
    for (const point of stripOutline) {
      const local = new THREE.Vector3(point.x, point.y, 0).applyMatrix4(transform);
      if (Math.hypot(local.x, local.y) > radius + 0.005) continue;
      const separation = polarGap(local, pinionOutline);
      assert.ok(separation >= -2e-7, `pose ${pose}: strip penetrates pinion by ${-separation}`);
      gap = Math.min(gap, separation);
    }
    for (const point of pinionOutline) {
      const local = new THREE.Vector3(point.x, point.y, 0).applyMatrix4(inverse);
      const query = stripQuery(local);
      assert.ok(!query.inside || query.distance < 2e-7, `pose ${pose}: pinion penetrates strip by ${query.distance}`);
      gap = Math.min(gap, query.distance);
    }
    assert.ok(gap < 0.004, `pose ${pose}: flank gap ${gap}`);
    largestGap = Math.max(largestGap, gap);
  }
  assert.equal(branches.size, 4);
  // Negative bevel offsets must keep all rendered caps and chamfers inside
  // the cut outline; an outward bevel could invalidate the planar check.
  const positions = toothStrip.geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const p = new THREE.Vector3().fromBufferAttribute(positions, index);
    const query = stripQuery(p);
    assert.ok(query.inside || query.distance < 2e-7, 'rendered tooth-strip vertex stays within the cut');
  }
  console.log('036 maximum sampled tooth clearance', largestGap);
});

test('036 has an open recessed groove, a clear guide pin, and a shaft that fits the upright slot', () => {
  const model = createMovementModel(catalog.movements[35]);
  // No flat overlay lies on (and z-fights with) the disk face: the ink rim
  // ring is a shallow extrusion standing on it.
  model.root.traverse((object) => {
    if (object.isMesh && object.visible) assert.notEqual(object.geometry.type, 'ShapeGeometry');
  });
  const { guidePin, grooveWalls, stationaryBar, toothStrip, backing, pinion } = model.root.userData.blocks;
  const geometry = model.root.userData.geometry;
  for (let pose = 0; pose < 96; pose += 1) {
    model.update(geometry.cycleDuration * (pose + 0.31) / 96, 0);
    model.root.updateMatrixWorld(true);
    const center = guidePin.getWorldPosition(new THREE.Vector3());
    const normal = model.root.userData.mangleContact.rightNormal;
    for (const sign of [-1, 1]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(center.x, center.y, 0.06),
        new THREE.Vector3(normal.x * sign, normal.y * sign, 0), 0, 0.10);
      const hits = ray.intersectObjects(grooveWalls, false);
      assert.ok(hits.length, `pose ${pose}: actual groove wall exists`);
      const clearance = hits[0].distance - geometry.guidePinRadius;
      assert.ok(clearance > 0.0078 && clearance < 0.0082,
        `pose ${pose}: groove wall clearance ${clearance}`);
      const barRay = new THREE.Raycaster(new THREE.Vector3(center.x, center.y, 0.56),
        new THREE.Vector3(sign, 0, 0), 0, 0.10);
      const barHits = barRay.intersectObject(stationaryBar, false);
      assert.ok(barHits.length && Math.abs(barHits[0].distance - 0.066) < 1e-7,
        'the actual upright slot leaves 0.006 clearance around the 0.06 shaft');
    }
    const pinBounds = new THREE.Box3().setFromObject(guidePin, true);
    const floorBounds = new THREE.Box3().setFromObject(backing, true);
    assert.ok(Math.abs(pinBounds.min.z - floorBounds.max.z - 0.035) < 1e-7,
      'the guide pin sits inside the groove without entering the floor');
    const stripBounds = new THREE.Box3().setFromObject(toothStrip, true);
    assert.ok(stripBounds.min.z <= 0.10 && stripBounds.min.z >= 0.095,
      'the raised strip joins the disk face');
    const pinionBounds = new THREE.Box3().setFromObject(pinion, true);
    const barBounds = new THREE.Box3().setFromObject(stationaryBar, true);
    assert.ok(pinionBounds.min.z > 0.11 && pinionBounds.max.z < barBounds.min.z - 0.09,
      'the pinion clears the disk face and the stationary bar');
  }
});
