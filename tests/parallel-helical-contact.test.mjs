import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../src/data/movements.json', import.meta.url)));

// Intersect the actual triangulated flank strips with an axial plane. The
// diagonal point matters: interpolating only the two end outlines misses the
// different shape made by the two triangles of a twisted quad.
function renderedSection(gear, step, fraction) {
  const geometry = gear.userData.body.geometry;
  const count = geometry.userData.sectionVertexCount;
  const positions = geometry.attributes.position;
  const points = [];
  for (let edge = 0; edge < count; edge += 1) {
    const base = (step * count + edge) * 4;
    const a = new THREE.Vector2(positions.getX(base), positions.getY(base));
    const b = new THREE.Vector2(positions.getX(base + 1), positions.getY(base + 1));
    const c = new THREE.Vector2(positions.getX(base + 2), positions.getY(base + 2));
    const d = new THREE.Vector2(positions.getX(base + 3), positions.getY(base + 3));
    points.push(a.clone().lerp(d, fraction));
    if (fraction > 0 && fraction < 1) points.push(a.clone().lerp(c, fraction));
    if (fraction === 1) assert.ok(c.distanceTo(b) < 0.04, 'adjacent axial samples resolve the helix');
  }
  return points;
}

function polygonQuery(points) {
  const bins = new Map();
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (a.distanceToSquared(b) < 1e-20) continue;
    const edge = { a, b, dx: b.x - a.x, dy: b.y - a.y, squared: a.distanceToSquared(b) };
    for (let bin = Math.floor(Math.min(a.y, b.y) / 0.01); bin <= Math.floor(Math.max(a.y, b.y) / 0.01); bin += 1) {
      if (!bins.has(bin)) bins.set(bin, []);
      bins.get(bin).push(edge);
    }
  }
  return (x, y) => {
    const bin = Math.floor(y / 0.01);
    let inside = false, distance = Infinity;
    for (const { a, b, dx, dy } of bins.get(bin) ?? []) {
      if ((a.y > y) !== (b.y > y) && x < dx * (y - a.y) / dy + a.x) inside = !inside;
    }
    for (let k = bin - 1; k <= bin + 1; k += 1) {
      for (const { a, dx, dy, squared } of bins.get(k) ?? []) {
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / squared));
        distance = Math.min(distance, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
      }
    }
    return { inside, distance };
  };
}

for (const id of [40, 41]) {
  test(`${id}: actual involute helices clear and engage across every axial strip`, () => {
    const model = createMovementModel(catalog.movements[id - 1]);
    const { driver, driven } = model.root.userData.blocks;
    const gears = [driver, driven];
    const axialSegments = driver.userData.axialSegments;
    let maxGap = 0;
    // Both faces, the herringbone crease, and every strip midpoint. Teeth
    // repeat after one input pitch; all 32 samples are offset from keyframes.
    const stations = [{ step: 0, fraction: 0 }, { step: axialSegments - 1, fraction: 1 },
      { step: axialSegments / 2, fraction: 0 }];
    for (let step = 0; step < axialSegments; step += 1) stations.push({ step, fraction: 0.5 });
    for (const { step, fraction } of stations) {
      const outlines = gears.map((gear) => renderedSection(gear, step, fraction));
      const queries = outlines.map(polygonQuery);
      const clouds = outlines.map((outline) => outline.flatMap((a, i) => [a, a.clone().lerp(outline[(i + 1) % outline.length], 0.5)]));
      for (let sample = 0; sample < 32; sample += 1) {
        model.update(model.root.userData.geometry.inputPeriod / driver.userData.teeth * (sample + 0.173) / 32, 0);
        model.root.updateMatrixWorld(true);
        let gap = Infinity;
        for (const side of [0, 1]) {
          const transform = gears[1 - side].userData.rotor.matrixWorld.clone().invert().multiply(gears[side].userData.rotor.matrixWorld).elements;
          const limit = (gears[1 - side].userData.tipRadius + 0.004) ** 2;
          for (const p of clouds[side]) {
            const x = p.x * transform[0] + p.y * transform[4] + transform[12];
            const y = p.x * transform[1] + p.y * transform[5] + transform[13];
            if (x * x + y * y > limit) continue;
            const q = queries[1 - side](x, y);
            assert.ok(!q.inside || q.distance < 2e-6,
              `${id}, strip ${step}, fraction ${fraction}, phase ${sample}: tooth penetration ${q.distance}`);
            gap = Math.min(gap, q.distance);
          }
        }
        assert.ok(gap < 0.0015, `${id}, strip ${step}, phase ${sample}: working gap ${gap}`);
        maxGap = Math.max(maxGap, gap);
      }
    }
    console.log(id, 'maximum sampled working gap', maxGap);
  });
}
