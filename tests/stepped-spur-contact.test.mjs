import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../src/data/movements.json', import.meta.url)));

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
    let inside = false, distance = Infinity;
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

test('044 actual involute outlines engage without penetration in all four rows', () => {
  const model = createMovementModel(catalog.movements[43]);
  const { driver, driven } = model.root.userData.blocks;
  const g = model.root.userData.geometry;
  let maxGap = 0, checked = 0;
  for (let row = 0; row < 4; row += 1) {
    const gears = [driver.userData.gears[row], driven.userData.gears[row]];
    const meshes = gears.map((gear) => gear.userData.body);
    const outlines = meshes.map((mesh) => mesh.geometry.parameters.shapes.getPoints().slice(0, -1));
    const queries = outlines.map(polygonQuery);
    const clouds = outlines.map((points) => points.flatMap((a, i) => {
      const b = points[(i + 1) % points.length];
      return [a, a.clone().lerp(b, 1 / 3), a.clone().lerp(b, 2 / 3)];
    }));
    const point = new THREE.Vector3();
    for (const [side, mesh] of meshes.entries()) {
      const positions = mesh.geometry.attributes.position;
      for (let index = 0; index < positions.count; index += 1) {
        point.fromBufferAttribute(positions, index);
        const query = queries[side](point);
        assert.ok(query.inside || query.distance < 2e-7, 'every actual chamfer vertex remains inside the outline');
      }
    }
    // Dense offset phases over one tooth engagement, plus different teeth
    // throughout a full revolution to include floating-point tessellation.
    const times = [
      ...Array.from({ length: 96 }, (_, i) => g.inputPeriod / g.driverTeeth * (i + 0.173) / 96),
      ...Array.from({ length: 65 }, (_, i) => g.inputPeriod * (i + 0.317) / 65),
    ];
    for (const time of times) {
      model.update(time, 0);
      model.root.updateMatrixWorld(true);
      let gap = Infinity;
      for (const side of [0, 1]) {
        const mate = 1 - side;
        const transform = meshes[mate].matrixWorld.clone().invert().multiply(meshes[side].matrixWorld);
        const limit = gears[mate].userData.outerRadius + 0.004;
        for (const p of clouds[side]) {
          point.set(p.x, p.y, 0).applyMatrix4(transform);
          if (Math.hypot(point.x, point.y) > limit) continue;
          const query = queries[mate](point);
          assert.ok(!query.inside || query.distance < 2e-7,
            'row ' + row + ', time ' + time + ': penetration ' + query.distance);
          gap = Math.min(gap, query.distance);
          checked += 1;
        }
      }
      assert.ok(gap < 0.0015, 'row ' + row + ', time ' + time + ': working gap ' + gap);
      maxGap = Math.max(maxGap, gap);
    }
  }
  console.log('044 actual outlines', { rows: 4, posesPerRow: 161, checked, maxGap });
});
