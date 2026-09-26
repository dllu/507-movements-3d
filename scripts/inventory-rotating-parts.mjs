// Inventory of turning parts, for two reviews:
//  1. Featureless turning bodies (plain pulleys, drums, rollers, discs,
//     sheaves) that should carry the shared quadrant rotation cue
//     (src/simulation/rotation-indicator.js) and do not.
//  2. Toothed rotors and their tooth-passing frequency (teeth passing a fixed
//     point per second of authored time, and per displayed second), for the
//     opt-in display cap FINE_TOOTH_PASSING_RATES in
//     src/simulation/display-timing.js.
//
// Each movement is built through the registry (presented, as in production)
// and sampled at several phases. A mesh turns when its world orientation
// changes between t and t + dt; its spin axis is the angular velocity carried
// into the mesh's geometry space. About that axis (through the bounding-box
// centre) a mesh is
//   - featureless when at least 97% of its surface area has normals with
//     |n . t| <= 0.25 (t tangential) and its radius is at least 3% of the
//     model size: a solid of revolution without teeth, spokes or lobes;
//   - toothed when its outer radius, binned by angle, has a dominant harmonic
//     k >= 8 (in any of nine axial slices) whose amplitude is at least 2% of
//     the radius and which the profile confirms by crossing its mid-line
//     about twice per tooth. Axial crown teeth and threads can be over- or
//     under-counted; check candidates against the factory's tooth counts.
// Candidates are for visual review; the classification does not decide
// whether a part's turning already shows (e.g. through a crank pin).
//
// Usage: node scripts/inventory-rotating-parts.mjs [ids...] [--out=file.json]
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const args = process.argv.slice(2);
const out = args.find((arg) => arg.startsWith('--out='))?.slice(6);
const ids = new Set(args.filter((arg) => /^\d+$/.test(arg)).map(Number));
const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const PHASES = 6;
const dt = 1e-4;
const BINS = 720;
const SLABS = 9;

function spinOf(previous, current) {
  const difference = previous.clone().invert().multiply(current).normalize();
  const sine = Math.hypot(difference.x, difference.y, difference.z);
  const angle = 2 * Math.atan2(sine, Math.abs(difference.w));
  if (sine < 1e-12) return { speed: 0, axis: null };
  const axis = new THREE.Vector3(difference.x, difference.y, difference.z).divideScalar(sine);
  return { speed: angle / dt, axis };
}

// Surface statistics of a geometry about an axis (geometry space) through
// its bounding-box centre.
function analyse(items, axis, axisPoint = null) {
  // items: [{ geometry, matrix }] in the body's frame.
  const box = new THREE.Box3();
  for (const { geometry, matrix } of items) {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox.clone().applyMatrix4(matrix));
  }
  const centre = axisPoint ? axisPoint.clone() : box.getCenter(new THREE.Vector3());
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), p = new THREE.Vector3(), t = new THREE.Vector3(), e = new THREE.Vector3();
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(axis)) > 0.9) u.set(0, 1, 0);
  u.addScaledVector(axis, -u.dot(axis)).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u);
  let total = 0, smooth = 0, maxRadius = 0;
  // Outer-radius profiles in SLABS axial slices, so that oblique (helical)
  // and stepped tooth rows show in the slice that cuts them.
  let axialLow = Infinity, axialHigh = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const w = e.set(x, y, z).sub(centre).dot(axis);
    axialLow = Math.min(axialLow, w); axialHigh = Math.max(axialHigh, w);
  }
  const profiles = Array.from({ length: SLABS }, () => new Float64Array(BINS).fill(-1));
  const sample = (point) => {
    e.copy(point).sub(centre);
    const x = e.dot(u), y = e.dot(v), r = Math.hypot(x, y);
    const bin = Math.min(BINS - 1, Math.floor((Math.atan2(y, x) + Math.PI) / (2 * Math.PI) * BINS));
    const slab = Math.max(0, Math.min(SLABS - 1,
      Math.floor((e.dot(axis) - axialLow) / (axialHigh - axialLow || 1) * SLABS)));
    if (r > profiles[slab][bin]) profiles[slab][bin] = r;
    if (r > maxRadius) maxRadius = r;
  };
  for (const { geometry, matrix } of items) {
  const position = geometry.attributes.position, index = geometry.index;
  const vertex = (tri, k) => (index ? index.getX(3 * tri + k) : 3 * tri + k);
  const triangles = index ? index.count / 3 : position.count / 3;
  const stride = Math.max(1, Math.floor(triangles / 20000));
  for (let tri = 0; tri < triangles; tri += stride) {
    a.fromBufferAttribute(position, vertex(tri, 0)).applyMatrix4(matrix);
    b.fromBufferAttribute(position, vertex(tri, 1)).applyMatrix4(matrix);
    c.fromBufferAttribute(position, vertex(tri, 2)).applyMatrix4(matrix);
    // Sample over the triangle finely enough in angle that the outer radius
    // is known in every angular bin (a rim's vertices alone would leave gaps
    // filled from a bore or web).
    let span = 0;
    for (const [p0, p1] of [[a, b], [b, c], [c, a]]) {
      e.copy(p0).sub(centre); const x0 = e.dot(u), y0 = e.dot(v);
      e.copy(p1).sub(centre); const x1 = e.dot(u), y1 = e.dot(v);
      let edgeSpan = Math.abs(Math.atan2(y1, x1) - Math.atan2(y0, x0));
      if (edgeSpan > Math.PI) edgeSpan = 2 * Math.PI - edgeSpan;
      span = Math.max(span, edgeSpan);
    }
    const steps = Math.min(48, Math.ceil(span / (Math.PI / BINS)) + 1);
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps - i; j += 1) {
        n.copy(a).multiplyScalar(1 - (i + j) / steps).addScaledVector(b, i / steps).addScaledVector(c, j / steps);
        sample(n);
      }
    }
    n.subVectors(b, a).cross(t.subVectors(c, a));
    const area = n.length();
    if (!(area > 0)) continue;
    n.divideScalar(area);
    p.addVectors(a, b).add(c).multiplyScalar(1 / 3).sub(centre);
    p.addScaledVector(axis, -p.dot(axis));
    const radius = p.length();
    if (radius < 1e-9) continue;
    t.crossVectors(axis, p).divideScalar(radius);
    total += area;
    if (Math.abs(n.dot(t)) <= 0.25) smooth += area;
  }
  }
  let best = { teeth: 0, amplitude: 0 };
  for (const profile of profiles) {
    const row = toothRow(profile);
    // A tooth row must reach near the body's outer radius.
    if (row.teeth && row.outer > 0.6 * maxRadius && row.amplitude > best.amplitude) best = row;
  }
  return { smoothFraction: total ? smooth / total : 0, maxRadius,
    teeth: best.teeth, amplitude: best.amplitude / (maxRadius || 1) };
}

// Dominant tooth harmonic of one outer-radius profile, confirmed by the
// profile crossing its mid-line about twice per tooth.
function toothRow(profile) {
  const filled = [...profile.keys()].filter((i) => profile[i] >= 0);
  if (filled.length < BINS / 4) return { teeth: 0, amplitude: 0, outer: 0 };
  const r = new Float64Array(BINS);
  for (let j = 0; j < filled.length; j += 1) {
    const i0 = filled[j], i1 = filled[(j + 1) % filled.length];
    const span = (i1 - i0 + BINS) % BINS || BINS;
    for (let s = 0; s < span; s += 1) {
      r[(i0 + s) % BINS] = profile[i0] + (profile[i1] - profile[i0]) * s / span;
    }
  }
  const mean = r.reduce((sum, x) => sum + x, 0) / BINS;
  let teeth = 0, amplitude = 0;
  for (let k = 8; k <= 300; k += 1) {
    let re = 0, im = 0;
    for (let i = 0; i < BINS; i += 1) {
      const angle = 2 * Math.PI * k * i / BINS;
      re += (r[i] - mean) * Math.cos(angle); im += (r[i] - mean) * Math.sin(angle);
    }
    const magnitude = 2 * Math.hypot(re, im) / BINS;
    if (magnitude > amplitude) { amplitude = magnitude; teeth = k; }
  }
  let low = Infinity, high = -Infinity;
  for (const x of r) { low = Math.min(low, x); high = Math.max(high, x); }
  const mid = (low + high) / 2;
  let crossings = 0;
  for (let i = 0; i < BINS; i += 1) if ((r[i] - mid) * (r[(i + 1) % BINS] - mid) < 0) crossings += 1;
  const periodic = Math.abs(crossings / 2 - teeth) <= Math.max(1, 0.05 * teeth);
  return periodic ? { teeth, amplitude, outer: high } : { teeth: 0, amplitude: 0, outer: 0 };
}

const report = {};
for (const movement of catalog.movements) {
  if (ids.size && !ids.has(movement.id)) continue;
  let model;
  try { model = createMovementModel(movement); } catch (error) { report[movement.id] = { error: error.message }; continue; }
  const root = model.root;
  const period = root.userData.animationTiming?.authoredCyclePeriod ?? 2 * Math.PI;
  root.updateMatrixWorld(true);
  const modelSize = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).length() || 1;
  const meshes = [];
  root.traverseVisible((object) => { if (object.isMesh && !object.isInstancedMesh && object.geometry?.attributes.position) meshes.push(object); });
  const nodes = [];
  root.traverse((object) => nodes.push(object));
  // A rigid body is the set of meshes under the same nearest moving node
  // (an ancestor-or-self whose local transform changes over the cycle).
  const moved = new Set();
  const locals = new Map();
  const bodies = new Map();
  let previousTime = 0;
  for (let phase = 0; phase < PHASES; phase += 1) {
    const time = period * (phase + 0.137) / PHASES;
    model.update?.(time, Math.max(0, time - previousTime));
    root.updateMatrixWorld(true);
    const before = new Map(nodes.map((node) => [node, node.getWorldQuaternion(new THREE.Quaternion())]));
    for (const node of nodes) {
      const key = [...node.quaternion.toArray(), ...node.position.toArray()].map((x) => x.toFixed(9)).join();
      if (locals.has(node) && locals.get(node) !== key) moved.add(node);
      locals.set(node, key);
    }
    model.update?.(time + dt, dt);
    root.updateMatrixWorld(true);
    previousTime = time + dt;
    for (const node of nodes) {
      const current = node.getWorldQuaternion(new THREE.Quaternion());
      const spin = spinOf(before.get(node), current);
      const entry = bodies.get(node) ?? { speed: 0, axis: null };
      if (spin.speed > entry.speed) { entry.speed = spin.speed; entry.axis = spin.axis.clone().normalize(); }
      bodies.set(node, entry);
      const key = [...node.quaternion.toArray(), ...node.position.toArray()].map((x) => x.toFixed(9)).join();
      if (locals.get(node) !== key) moved.add(node);
    }
  }
  const groups = new Map();
  for (const mesh of meshes) {
    let body = mesh;
    while (body !== root && !moved.has(body)) body = body.parent;
    if (!groups.has(body)) groups.set(body, []);
    groups.get(body).push(mesh);
  }
  const parts = [];
  for (const [body, members] of groups) {
    const { speed, axis } = bodies.get(body) ?? {};
    if (!(speed >= 1e-3) || !axis) continue;
    body.updateMatrixWorld(true);
    const inverse = body.matrixWorld.clone().invert();
    const items = members.map((mesh) => ({ geometry: mesh.geometry, matrix: inverse.clone().multiply(mesh.matrixWorld) }));
    const stats = analyse(items, axis);
    const worldRadius = stats.maxRadius * Math.max(...body.getWorldScale(new THREE.Vector3()).toArray().map(Math.abs));
    let role = '';
    for (let node = body; node && !role; node = node.parent) role = node.userData.role || node.name || '';
    if (!role) role = members.map((mesh) => mesh.userData.role || mesh.name).find(Boolean) || body.type;
    const part = {
      role,
      meshes: members.length,
      speed: Number(speed.toFixed(4)),
      radiusFraction: Number((worldRadius / modelSize).toFixed(4)),
      smoothFraction: Number(stats.smoothFraction.toFixed(3)),
      teeth: stats.teeth,
      toothAmplitude: Number(stats.amplitude.toFixed(4)),
      cue: members.some((mesh) => [mesh.material].flat().some((material) => material?.userData?.rotationIndicator)),
    };
    part.featureless = part.smoothFraction >= 0.97 && part.radiusFraction >= 0.03;
    // Plain turned meshes inside a featured body (a disc carrying a crank
    // pin, a drum on a shaft with a key): solids of revolution about the
    // body's own spin axis (through the body's origin). Toothed bodies are
    // skipped; spoked wheels' rims still show here and need review.
    part.plainMeshes = [];
    if (!part.featureless && !(part.teeth >= 8 && part.toothAmplitude >= 0.02)) {
      for (const mesh of members) {
        const item = [{ geometry: mesh.geometry, matrix: inverse.clone().multiply(mesh.matrixWorld) }];
        const own = analyse(item, axis, new THREE.Vector3());
        const radiusFraction = own.maxRadius * Math.max(...body.getWorldScale(new THREE.Vector3()).toArray().map(Math.abs)) / modelSize;
        const cue = [mesh.material].flat().some((material) => material?.userData?.rotationIndicator);
        if (own.smoothFraction >= 0.97 && radiusFraction >= 0.03 && !cue) {
          part.plainMeshes.push(mesh.userData.role || mesh.name || mesh.geometry.type);
        }
      }
    }
    part.toothed = !part.featureless && part.teeth >= 8 && part.toothAmplitude >= 0.02;
    if (part.toothed) part.toothPassingRate = Number((speed * part.teeth / (2 * Math.PI)).toFixed(4));
    parts.push(part);
  }
  const toothed = parts.filter((part) => part.toothed);
  const fastest = toothed.reduce((best, part) => (!best || part.toothPassingRate > best.toothPassingRate ? part : best), null);
  const timing = root.userData.animationTiming ?? {};
  report[movement.id] = {
    playbackTimeScale: timing.playbackTimeScale, displayCycleDuration: timing.displayCycleDuration,
    featurelessWithoutCue: parts.filter((part) => part.featureless && !part.cue).map((part) => part.role),
    featurelessWithCue: parts.filter((part) => part.featureless && part.cue).map((part) => part.role),
    plainMeshesWithoutCue: parts.flatMap((part) => part.plainMeshes.map((role) => `${part.role} > ${role}`)),
    ...(fastest ? { toothPassingRate: fastest.toothPassingRate, toothedPart: fastest.role, teeth: fastest.teeth } : {}),
    parts,
  };
  root.traverse((object) => { object.geometry?.dispose?.(); });
  if (movement.id % 25 === 0) process.stderr.write(`inventoried ${movement.id}\n`);
}
if (out) await writeFile(out, JSON.stringify(report, null, 1));
else {
  for (const [id, row] of Object.entries(report)) {
    if (row.error) { console.log(id, 'ERROR', row.error); continue; }
    const tooth = row.toothPassingRate ? ` teeth ${row.teeth} @ ${row.toothPassingRate}/s authored,`
      + ` ${(row.toothPassingRate * row.playbackTimeScale).toFixed(2)}/s displayed (${row.toothedPart})` : '';
    const plain = row.plainMeshesWithoutCue.length ? ` PLAIN-MESH ${[...new Set(row.plainMeshesWithoutCue)].join(', ')}` : '';
    console.log(id, row.featurelessWithoutCue.length ? `NO-CUE ${[...new Set(row.featurelessWithoutCue)].join(', ')}` : '', plain, tooth);
  }
}
