import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function polygonQuery(points) {
  const bins = new Map();
  for (const [index, a] of points.entries()) {
    const b = points[(index + 1) % points.length];
    if (a.distanceToSquared(b) < 1e-20) continue;
    for (let bin = Math.floor(Math.min(a.y, b.y) / 0.01);
      bin <= Math.floor(Math.max(a.y, b.y) / 0.01); bin += 1) {
      if (!bins.has(bin)) bins.set(bin, []);
      bins.get(bin).push({ a, b });
    }
  }
  return (point) => {
    const bin = Math.floor(point.y / 0.01);
    let inside = false;
    let distance = Infinity;
    for (const { a, b } of bins.get(bin) ?? []) {
      if ((a.y > point.y) !== (b.y > point.y)
        && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    for (let neighbor = bin - 1; neighbor <= bin + 1; neighbor += 1) {
      for (const { a, b } of bins.get(neighbor) ?? []) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const fraction = THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.y - a.y) * dy)
          / (dx * dx + dy * dy), 0, 1);
        distance = Math.min(distance, Math.hypot(point.x - a.x - fraction * dx, point.y - a.y - fraction * dy));
      }
    }
    return { inside, distance };
  };
}

function edgeSamples(points) {
  const result = [];
  for (const [index, a] of points.entries()) {
    const b = points[(index + 1) % points.length];
    const count = Math.max(1, Math.ceil(a.distanceTo(b) / 0.003));
    for (let sample = 0; sample < count; sample += 1) result.push(a.clone().lerp(b, sample / count));
  }
  return result;
}

test('038 actual sector outlines clear and remain engaged through all three ratio changes', () => {
  const model = createMovementModel(catalog.movements[37]);
  const { driver, driven } = model.root.userData.blocks;
  const meshes = [driver.userData.mesh, driven.userData.mesh];
  const outlines = meshes.map((mesh) => mesh.geometry.parameters.shapes.getPoints().slice(0, -1));
  const queries = outlines.map(polygonQuery);
  const clouds = outlines.map(edgeSamples);
  const turn = 2 * Math.PI;
  const angles = Array.from({ length: 512 }, (_, index) => turn * (index + 0.173) / 512);
  for (const boundary of [0, Math.PI / 6, 3 * Math.PI / 2, turn]) {
    for (const epsilon of [-0.001, -0.0001, 0, 0.0001, 0.001]) angles.push(boundary + epsilon);
  }
  const point = new THREE.Vector3();
  let largestGap = 0;
  for (const angle of angles) {
    model.update(angle / model.root.userData.geometry.driverAngularSpeed, 0);
    model.root.updateMatrixWorld(true);
    let gap = Infinity;
    for (const side of [0, 1]) {
      const transform = meshes[1 - side].matrixWorld.clone().invert().multiply(meshes[side].matrixWorld);
      for (const local of clouds[side]) {
        point.set(local.x, local.y, 0).applyMatrix4(transform);
        if (Math.hypot(point.x, point.y) > 2.23) continue;
        const query = queries[1 - side](point);
        assert.ok(!query.inside || query.distance < 2e-7,
          `input ${angle}: side ${side} penetrates the mating sector by ${query.distance}`);
        gap = Math.min(gap, query.distance);
      }
    }
    assert.ok(gap < 0.004, `input ${angle}: working tooth gap ${gap}`);
    largestGap = Math.max(largestGap, gap);
  }
  for (const [side, mesh] of meshes.entries()) {
    const positions = mesh.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index);
      const query = queries[side](point);
      assert.ok(query.inside || query.distance < 2e-7, 'rendered chamfer outside outline: side ' + side + ', vertex ' + index + ', distance ' + query.distance);
    }
  }
  console.log('038 maximum sampled working gap', largestGap);
});

test('038 exposes a fixed center link with real shaft bores and clearance over the rotating gears', () => {
  const model = createMovementModel(catalog.movements[37]);
  const { driver, driven, centerLink, collars } = model.root.userData.blocks;
  const geometry = model.root.userData.geometry;
  for (let sample = 0; sample < 33; sample += 1) {
    model.update(geometry.cycleDuration * sample / 32, 0);
    model.root.updateMatrixWorld(true);
    const linkBounds = new THREE.Box3().setFromObject(centerLink);
    for (const [index, gear] of [driver, driven].entries()) {
      const collar = collars[index];
      const collarBounds = new THREE.Box3().setFromObject(collar);
      const gearBounds = new THREE.Box3().setFromObject(gear.userData.mesh);
      const hubBounds = new THREE.Box3().setFromObject(gear.userData.hub);
      assert.ok(collarBounds.min.z - hubBounds.max.z > 0.0049, 'fixed collar clears the spinning hub');
      assert.ok(linkBounds.min.z - gearBounds.max.z > 0.064, 'the center link clears every tooth and radial face');
      for (let ray = 0; ray < 16; ray += 1) {
        const angle = 2 * Math.PI * ray / 16;
        const origin = new THREE.Vector3(gear.position.x, 0, 0.1975);
        const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
        const hits = new THREE.Raycaster(origin, direction, 0, 0.4).intersectObject(collar, false);
        assert.ok(hits.length > 0 && hits[0].distance - geometry.shaftRadius > 0.0059,
          'the shaft has running clearance inside the actual collar bore');
      }
    }
  }
});
