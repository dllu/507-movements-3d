// Offline swept-cut plates for the gravity escapements 309-312. Each model
// declares its working plates (pallet arms, lift pads, stop blocks) in the
// owning group's frame as a union of bands, discs and polygons with a z slab.
// The generator subtracts, in that frame, the envelope swept over one full
// pendulum period by every rendered mesh of every other body that reaches the
// slab, grown by a running clearance. Driving pieces are exact rendered
// geometry: convex primitives as hulls, everything else triangle by triangle.
// The period covers every relative configuration because each wheel advances
// by a whole symmetry pitch per period and non-periodic parts (spokes, flies)
// are axially outside every plate slab. The browser only extrudes the baked
// outlines; a fingerprint of the plates and all driving motion keeps them
// current.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import polygonClipping from 'polygon-clipping';
import * as THREE from 'three';

export const RUNNING_CLEARANCE = 0.006;
const SAMPLES_PER_PERIOD = 6000;
const EMIT_STEP = 0.008;
const CONVEX = new Set(['CylinderGeometry', 'BoxGeometry', 'SphereGeometry']);
const BAKED_URL = new URL('../src/simulation/baked/gravity-escapement-plates.js', import.meta.url);

const snap = (v) => Math.round(v * 1e5) / 1e5;
function hull(points) {
  const unique = new Map(points.map((q) => [snap(q[0]), snap(q[1])]).map((q) => [q.join(','), q]));
  const p = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return null;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  const ring = lower.slice(0, -1).concat(upper.slice(0, -1));
  return ring.length >= 3 ? [[...ring, ring[0]]] : null;
}
const grown = (points, radius) => points.flatMap(([x, y]) => Array.from({ length: 8 }, (_, i) => [
  x + radius * Math.cos(i * Math.PI / 4) / Math.cos(Math.PI / 8),
  y + radius * Math.sin(i * Math.PI / 4) / Math.cos(Math.PI / 8)]));
const area = (ring) => Math.abs(ring.reduce((s, [x, y], i) => { const [u, v] = ring[(i + 1) % ring.length]; return s + x * v - u * y; }, 0) / 2);
const closeRing = (ring) => [...ring, ring[0]];
const snapMulti = (multi) => multi.map((poly) => poly.map((ring) => {
  const out = [];
  for (const [x, y] of ring) {
    const q = [snap(x), snap(y)];
    if (!out.length || out.at(-1)[0] !== q[0] || out.at(-1)[1] !== q[1]) out.push(q);
  }
  return out;
})).map((poly) => (poly[0]?.length >= 4 ? poly.filter((ring) => ring.length >= 4) : [])).filter((poly) => poly.length);

function ownerMeshes(owner) {
  const set = new Set();
  owner.traverse((object) => { if (object.isMesh) set.add(object); });
  return set;
}

function period(model) {
  return model.root.userData.geometry.pendulumPeriod;
}

// Everything the baked outlines depend on: the declared plates, the rendered
// geometry of every other mesh, and all world transforms over one period.
export function plateInputFingerprint(model) {
  const root = model.root;
  const plates = root.userData.sweptPlates;
  const plateMeshes = new Set(plates.map((plate) => plate.mesh));
  const hash = createHash('sha256');
  hash.update(JSON.stringify(plates.map(({ key, z0, z1, primitives }) => ({ key, z0, z1, primitives })),
    (_, v) => (typeof v === 'number' ? Number(v.toFixed(7)) : v)));
  const meshes = [];
  root.traverse((object) => { if (object.isMesh && !plateMeshes.has(object)) meshes.push(object); });
  for (const mesh of meshes) {
    const p = mesh.geometry.attributes.position;
    hash.update(`${mesh.userData.role ?? ''}:${mesh.geometry.type}:${p.count}:`);
    for (let i = 0; i < p.count; i += 1) hash.update(`${p.getX(i).toFixed(6)},${p.getY(i).toFixed(6)},${p.getZ(i).toFixed(6)};`);
  }
  const owners = [...new Set(plates.map((plate) => plate.owner))];
  for (let s = 0; s < 24; s += 1) {
    model.update(period(model) * s / 24, 0.016); root.updateMatrixWorld(true);
    for (const object of [...meshes, ...owners]) {
      hash.update(`${object.visible ? 1 : 0}${object.matrixWorld.elements.map((e) => e.toFixed(7)).join(',')}`);
    }
  }
  return hash.digest('hex').slice(0, 16);
}

function blankOf(plate) {
  return polygonClipping.union(...plate.primitiveRings.map((ring) => [[...closeRing(ring)]]));
}

export function cutPlate(model, plate) {
  const root = model.root;
  const plates = root.userData.sweptPlates;
  const plateMeshes = new Set(plates.map((item) => item.mesh));
  const own = ownerMeshes(plate.owner);
  const blank = snapMulti(blankOf(plate));
  const blankBox = new THREE.Box2();
  for (const poly of blank) for (const [x, y] of poly[0]) blankBox.expandByPoint(new THREE.Vector2(x, y));
  blankBox.expandByScalar(RUNNING_CLEARANCE + EMIT_STEP);
  model.update(0, 0.016); root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4(), relative = new THREE.Matrix4(), v = new THREE.Vector3();
  const pieces = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh || own.has(mesh) || plateMeshes.has(mesh)) return;
    const p = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    inverse.copy(plate.owner.matrixWorld).invert();
    relative.copy(inverse).multiply(mesh.matrixWorld);
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < p.count; i += 1) { v.fromBufferAttribute(p, i).applyMatrix4(relative); zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z); }
    if (zMax < plate.z0 - RUNNING_CLEARANCE || zMin > plate.z1 + RUNNING_CLEARANCE) return;
    const local = Array.from({ length: p.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, i));
    if (CONVEX.has(mesh.geometry.type)) { pieces.push({ mesh, vertices: local }); return; }
    const count = index?.count ?? p.count;
    for (let t = 0; t < count; t += 3) {
      const tri = [0, 1, 2].map((j) => local[index ? index.getX(t + j) : t + j]);
      const [a, b, c] = tri.map((q) => q.clone().applyMatrix4(relative));
      if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-10) continue;
      pieces.push({ mesh, vertices: tri });
    }
  });
  const clips = [];
  const samples = SAMPLES_PER_PERIOD;
  const last = new Array(pieces.length).fill(null);
  const project = (piece) => piece.vertices.map((q) => { v.copy(q).applyMatrix4(piece.relative); return [v.x, v.y]; });
  for (let s = 0; s <= samples; s += 1) {
    model.update(period(model) * s / samples, period(model) / samples); root.updateMatrixWorld(true);
    inverse.copy(plate.owner.matrixWorld).invert();
    const relatives = new Map();
    pieces.forEach((piece, i) => {
      let visible = true;
      for (let node = piece.mesh; node; node = node.parent) if (!node.visible) { visible = false; break; }
      if (!visible) { last[i] = null; return; }
      if (!relatives.has(piece.mesh)) relatives.set(piece.mesh, new THREE.Matrix4().copy(inverse).multiply(piece.mesh.matrixWorld));
      piece.relative = relatives.get(piece.mesh);
      const now = project(piece);
      const previous = last[i];
      if (previous && s < samples) {
        let moved = 0;
        for (let k = 0; k < now.length; k += 1) moved = Math.max(moved, Math.hypot(now[k][0] - previous[k][0], now[k][1] - previous[k][1]));
        if (moved < EMIT_STEP) return;
      }
      const points = previous ? [...previous, ...now] : now;
      const box = new THREE.Box2();
      for (const [x, y] of points) box.expandByPoint(new THREE.Vector2(x, y));
      last[i] = now;
      if (!box.intersectsBox(blankBox)) return;
      const clip = hull(grown(points, RUNNING_CLEARANCE));
      if (clip) clips.push(clip);
    });
  }
  let shape = blank;
  for (let i = 0; i < clips.length; i += 24) {
    const batch = clips.slice(i, i + 24);
    try {
      shape = snapMulti(polygonClipping.difference(shape, ...batch));
    } catch {
      for (const clip of batch) {
        try { shape = snapMulti(polygonClipping.difference(shape, clip)); } catch { /* degenerate clip */ }
      }
    }
  }
  const sorted = shape.sort((a, b) => area(b[0]) - area(a[0]));
  const kept = sorted[0];
  const round = (ring) => ring.slice(0, -1).map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))]);
  const blankArea = blank.reduce((sum, poly) => sum + area(poly[0]) - poly.slice(1).reduce((h, ring) => h + area(ring), 0), 0);
  const keptArea = kept ? area(kept[0]) - kept.slice(1).reduce((h, ring) => h + area(ring), 0) : 0;
  return {
    outer: kept ? round(kept[0]) : [],
    holes: kept ? kept.slice(1).map(round) : [],
    blankArea: Number(blankArea.toFixed(5)),
    keptArea: Number(keptArea.toFixed(5)),
    discardedArea: Number(sorted.slice(1).reduce((sum, poly) => sum + area(poly[0]), 0).toFixed(5)),
    clips: clips.length,
  };
}

// Same model the registry returns (it adds only display timing), without
// importing every other authored family.
export async function createGravityEscapementModel(id) {
  const { createAuthoredGravityEscapementMovement } = await import('../src/simulation/authored-gravity-escapements.js');
  const { applyDisplayTiming } = await import('../src/simulation/display-timing.js');
  const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8')).movements;
  const movement = catalog[id - 1];
  const model = createAuthoredGravityEscapementMovement(movement);
  model.root.userData.archetype ??= movement.archetype;
  return applyDisplayTiming(model, movement);
}

export async function loadBakedPlates() {
  try {
    return (await import(`${BAKED_URL.href}?t=${Date.now()}`)).GRAVITY_ESCAPEMENT_PLATES;
  } catch {
    return {};
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2).filter((arg) => /^\d+$/.test(arg)).map(Number);
  const existing = await loadBakedPlates();
  const output = { ...existing };
  for (const id of ids.length ? ids : [309, 310, 311, 312]) {
    const model = await createGravityEscapementModel(id);
    const plates = model.root.userData.sweptPlates;
    const entry = { inputHash: plateInputFingerprint(model), runningClearance: RUNNING_CLEARANCE,
      samplesPerPeriod: SAMPLES_PER_PERIOD, plates: {} };
    for (const plate of plates) {
      const result = cutPlate(model, plate);
      entry.plates[plate.key] = result;
      console.log(`${id} ${plate.key}: ${result.outer.length} vertices, ${result.holes.length} holes, clips ${result.clips}, area ${result.keptArea}/${result.blankArea}, discarded ${result.discardedArea}`);
    }
    output[id] = entry;
  }
  const ordered = Object.fromEntries(Object.keys(output).sort().map((key) => [key, output[key]]));
  await writeFile(BAKED_URL, `// Generated by scripts/generate-gravity-escapement-plates.mjs; do not edit.\nexport const GRAVITY_ESCAPEMENT_PLATES = Object.freeze(${JSON.stringify(ordered)});\n`);
}
