// Pass 88 lane s: steam volumes in the sectioned engines 418, 425-429 and
// the disk engine 347 draw each connected body of steam as one closed
// surface (no internal sheet where two volumes meet, no area drawn twice) and
// stop short of the solids they fill.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { setSteamRegions, steamEdgeIndex, steamVolume } from '../src/simulation/steam-section-kit.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8')).movements;
const rect = (x0, y0, x1, y1) => [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]];

const drawn = (mesh) => {
  const position = mesh.geometry.attributes.position;
  const normal = mesh.geometry.attributes.normal;
  const count = mesh.visible ? mesh.geometry.drawRange.count : 0;
  return { position, normal, count };
};

// Side-wall segments (bottom edge of each wall triangle, outward normal).
function wallSegments(meshes) {
  const segments = [];
  meshes.forEach((mesh, owner) => {
    const { position, normal, count } = drawn(mesh);
    for (let t = 0; t < count; t += 3) {
      if (Math.abs(normal.getZ(t)) > 1e-6) continue;
      const vertices = [0, 1, 2].map((k) => [position.getX(t + k), position.getY(t + k), position.getZ(t + k)]);
      const zMin = Math.min(...vertices.map((v) => v[2]));
      const low = vertices.filter((v) => Math.abs(v[2] - zMin) < 1e-9);
      if (low.length !== 2) continue;
      const [a, b] = low;
      segments.push({ owner, a, b, n: [normal.getX(t), normal.getY(t)], minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]) });
    }
  });
  return segments;
}

// Total length along which two wall segments face each other on one line:
// an internal sheet between two abutting volumes.
function internalSheetLength(meshes, tolerance = 1e-5) {
  const segments = wallSegments(meshes).sort((p, q) => p.minX - q.minX);
  let length = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    const dx = s.b[0] - s.a[0];
    const dy = s.b[1] - s.a[1];
    const l2 = dx * dx + dy * dy;
    if (!(l2 > 0)) continue;
    const l = Math.sqrt(l2);
    for (let j = i + 1; j < segments.length && segments[j].minX <= s.maxX + tolerance; j += 1) {
      const o = segments[j];
      if (s.n[0] * o.n[0] + s.n[1] * o.n[1] > -0.999) continue;
      const off = (p) => Math.abs((p[0] - s.a[0]) * dy - (p[1] - s.a[1]) * dx) / l;
      if (off(o.a) > tolerance || off(o.b) > tolerance) continue;
      const t = (p) => ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / l2;
      const lo = Math.max(0, Math.min(t(o.a), t(o.b)));
      const hi = Math.min(1, Math.max(t(o.a), t(o.b)));
      if (hi > lo) length += (hi - lo) * l;
    }
  }
  return length;
}

// Largest number of front caps covering one sample point (1: no steam
// drawn twice).
function maximumCapCover(meshes, cells = 240) {
  const triangles = [];
  const box = new THREE.Box2();
  for (const mesh of meshes) {
    const { position, normal, count } = drawn(mesh);
    for (let t = 0; t < count; t += 3) {
      if (normal.getZ(t) < 0.999) continue;
      const tri = [0, 1, 2].map((k) => [position.getX(t + k), position.getY(t + k)]);
      tri.forEach(([x, y]) => box.expandByPoint(new THREE.Vector2(x, y)));
      triangles.push(tri);
    }
  }
  if (!triangles.length) return 0;
  const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) / cells;
  const cover = new Map();
  let maximum = 0;
  for (const [a, b, c] of triangles) {
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-14) continue;
    const i0 = Math.floor((Math.min(a[0], b[0], c[0]) - box.min.x) / size);
    const i1 = Math.ceil((Math.max(a[0], b[0], c[0]) - box.min.x) / size);
    const j0 = Math.floor((Math.min(a[1], b[1], c[1]) - box.min.y) / size);
    const j1 = Math.ceil((Math.max(a[1], b[1], c[1]) - box.min.y) / size);
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        // sample points off any exact grid line of the source outlines
        const x = box.min.x + (i + 0.3183) * size;
        const y = box.min.y + (j + 0.6180) * size;
        const w0 = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area;
        const w1 = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 <= 1e-9 || w1 <= 1e-9 || w2 <= 1e-9) continue;
        const key = i * 100003 + j;
        const value = (cover.get(key) ?? 0) + 1;
        cover.set(key, value);
        maximum = Math.max(maximum, value);
      }
    }
  }
  return maximum;
}

const steamMeshesOf = (root) => {
  const meshes = [];
  root.traverse((object) => { if (object.isMesh && object.userData.steamVolume) meshes.push(object); });
  return meshes;
};

test('p88-s kit: abutting steam regions drop their shared walls, and sealed buffers keep nothing past the draw range', () => {
  const index = steamEdgeIndex([rect(0, 0, 1, 1), rect(1, 0.25, 2, 0.75)]);
  // the right wall of the left square, x = 1 from y 0 to 1, is shared over y 0.25-0.75
  const open = index.uncovered(1, 0, 1, 1, rect(0, 0, 1, 1)[0][0]);
  assert.deepEqual(open.map((span) => span.map((v) => Number(v.toFixed(6)))), [[0, 0.25], [0.75, 1]]);
  const a = steamVolume('a', 0, 1, { sealed: true, capacity: 600 });
  const b = steamVolume('b', 0, 1, { sealed: true, capacity: 600 });
  a.userData.setRegion(rect(0, 0, 3, 3), 1);
  const big = a.geometry.drawRange.count;
  setSteamRegions([{ mesh: a, region: rect(0, 0, 1, 1) }, { mesh: b, region: rect(1, 0, 2, 1) }]);
  assert.ok(a.geometry.drawRange.count < big);
  assert.equal(internalSheetLength([a, b]), 0);
  assert.equal(maximumCapCover([a, b]), 1);
  const tail = a.geometry.attributes.position.array.subarray(a.geometry.drawRange.count * 3);
  assert.ok(tail.every((v) => v === 0), 'no stale triangles past the draw range');
  // walls are still drawn where no other steam abuts
  assert.equal(wallSegments([a, b]).length, 6);
});

for (const id of [425, 426, 427, 428, 429]) {
  test(`p88-s ${id}: every body of steam is one closed surface: no internal sheet, nothing drawn twice`, () => {
    const model = createMovementModel(catalog[id - 1]);
    try {
      const meshes = steamMeshesOf(model.root);
      assert.ok(meshes.length >= 4);
      const period = model.root.userData.animationTiming.authoredCyclePeriod;
      for (let k = 0; k < 24; k += 1) {
        model.update(period * (k + 0.37) / 24, period / 24);
        assert.equal(internalSheetLength(meshes), 0, `phase ${k}/24: internal steam sheet`);
        assert.ok(maximumCapCover(meshes) <= 1, `phase ${k}/24: steam drawn twice`);
        for (const mesh of meshes) {
          const tail = mesh.geometry.attributes.position.array.subarray(mesh.geometry.drawRange.count * 3);
          assert.ok(tail.every((v) => v === 0), `${mesh.userData.role}: stale triangles past the draw range`);
        }
      }
    } finally {
      disposeObject3D(model.root);
    }
  });
}

test('p88-s 427: the casing has no zero-area spike at the neck mouths and the crescent tips stop short of the bore', () => {
  const model = createMovementModel(catalog[426]);
  try {
    const { casing } = model.root.userData.blocks;
    for (const polygon of casing.userData.sectionOutline) {
      for (const ring of polygon) {
        const points = ring.slice(0, -1);
        for (let i = 0; i < points.length; i += 1) {
          const a = points[(i + points.length - 1) % points.length];
          const b = points[i];
          const c = points[(i + 1) % points.length];
          const u = [a[0] - b[0], a[1] - b[1]];
          const v = [c[0] - b[0], c[1] - b[1]];
          const cross = u[0] * v[1] - u[1] * v[0];
          const dot = u[0] * v[0] + u[1] * v[1];
          assert.ok(!(Math.abs(cross) < 1e-9 * Math.hypot(...u) * Math.hypot(...v) && dot > 0), `spike at ${b}`);
        }
      }
    }
    const { behind, between, ahead } = model.root.userData.blocks.steam;
    const period = model.root.userData.animationTiming.authoredCyclePeriod;
    for (let k = 0; k < 12; k += 1) {
      model.update(period * k / 12, 0);
      for (const mesh of [behind, between, ahead]) {
        const { position, count } = drawn(mesh);
        for (let i = 0; i < count; i += 1) {
          const x = position.getX(i);
          const y = position.getY(i);
          if (y > 6) assert.ok(Math.abs(x) >= 1.44, 'no steam where the hub lies within 0.025 of the bore');
        }
      }
    }
  } finally {
    disposeObject3D(model.root);
  }
});

test('p88-s 418: the port steam stops below the valve seat\'s top face', () => {
  const model = createMovementModel(catalog[417]);
  try {
    let seat = null;
    const ports = [];
    model.root.traverse((object) => {
      if (object.userData.role === 'fixed-horizontal-valve-seat') seat = object;
      if (object.userData.steamVolume && /port-and-passage/.test(object.userData.role)) ports.push(object);
    });
    assert.equal(ports.length, 3);
    model.root.updateMatrixWorld(true);
    const seatTop = new THREE.Box3().setFromObject(seat).max.y;
    const diagonal = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).length();
    for (const mesh of ports) {
      const { position, count } = drawn(mesh);
      const v = new THREE.Vector3();
      let top = -Infinity;
      for (let i = 0; i < count; i += 1) top = Math.max(top, v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).y);
      assert.ok(seatTop - top > 5e-4 * diagonal, `${mesh.userData.role} top ${top} vs seat ${seatTop}`);
    }
  } finally {
    disposeObject3D(model.root);
  }
});

test('p88-s 347: each side\'s steam is split into live and eduction cells at its pinch, with no duplicated faces', () => {
  const model = createMovementModel(catalog[346]);
  try {
    const cells = model.root.userData.blocks.steamCells;
    const period = model.root.userData.animationTiming?.authoredCyclePeriod ?? 10;
    const width = (mesh, u0) => {
      // latitude span of the cell's vertices near azimuth u0 on its outer sphere
      const { position, count } = drawn(mesh);
      let outer = 0;
      for (let i = 0; i < count; i += 1) outer = Math.max(outer, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)));
      let lo = Infinity; let hi = -Infinity;
      for (let i = 0; i < count; i += 1) {
        const x = position.getX(i); const y = position.getY(i); const z = position.getZ(i);
        const r = Math.hypot(x, y, z);
        if (r < outer - 0.02) continue;
        const u = THREE.MathUtils.euclideanModulo(Math.atan2(z, y) + Math.PI / 2, Math.PI * 2);
        const d = Math.abs(THREE.MathUtils.euclideanModulo(u - u0 + Math.PI, Math.PI * 2) - Math.PI);
        if (d > 0.03) continue;
        const lambda = Math.asin(x / r);
        lo = Math.min(lo, lambda); hi = Math.max(hi, lambda);
      }
      return hi - lo;
    };
    let checked = 0;
    for (let k = 0; k < 16; k += 1) {
      model.update(period * (k + 0.1) / 16, period / 16);
      for (const mesh of cells) {
        const { position, count } = drawn(mesh);
        const seen = new Set();
        for (let t = 0; t < count; t += 3) {
          const key = [0, 1, 2].map((j) => [position.getX(t + j), position.getY(t + j), position.getZ(t + j)]
            .map((v) => v.toFixed(5)).join(',')).sort().join('|');
          assert.ok(!seen.has(key), `${mesh.userData.role}: duplicated face`);
          seen.add(key);
        }
        const pinchU = mesh.userData.pinchU;
        // the pinch lies in the drawn rear half, clear of the diaphragm and the section plane
        const inRear = (pinchU > 0.25 && pinchU < Math.PI / 2 - 0.1) || (pinchU > 3 * Math.PI / 2 + 0.1 && pinchU < 2 * Math.PI - 0.25);
        if (!inRear) continue;
        assert.ok(width(mesh, pinchU) < 0.02, `${mesh.userData.role}: cell pinched at the split`);
        checked += 1;
      }
    }
    assert.ok(checked >= 8);
  } finally {
    disposeObject3D(model.root);
  }
});
