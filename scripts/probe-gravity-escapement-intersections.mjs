// Full-pair variant of scripts/screen-body-intersections.mjs for the gravity
// escapements 309-312. It uses the same rigid-body clustering, closed-target
// rule, coaxial classification and sampled penetration depth, but returns every
// pair instead of the worst forty, and accepts an already-built model so tests
// can screen deliberately broken variants. Sampled triage, not certification.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { densePoints } from '../tests/helpers/dense-points.mjs';
import { solidSurface } from '../tests/helpers/solid-surface.mjs';

const FLUID = /water|fluid|steam|gas(?!ket)|mercury|air(?!-?tight)|flow|stream|jet|spray|plume|smoke|flame|liquid|ink-trace|trace|glow|shadow|envelope|highlight|ghost/i;

function closed(geometry) {
  const p = geometry.attributes.position, index = geometry.index, key = new Map(), edges = new Map();
  const vid = (i) => {
    const k = `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
    if (!key.has(k)) key.set(k, key.size);
    return key.get(k);
  };
  const count = index?.count ?? p.count;
  for (let t = 0; t < count; t += 3) {
    const v = [0, 1, 2].map((j) => vid(index ? index.getX(t + j) : t + j));
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
    for (const [a, b] of [[v[0], v[1]], [v[1], v[2]], [v[2], v[0]]]) {
      const e = a < b ? `${a}_${b}` : `${b}_${a}`;
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  }
  for (const n of edges.values()) if (n % 2) return false;
  return edges.size > 0;
}

export function probeBodyIntersections(model, { samples = 65, spacing: requestedSpacing } = {}) {
  const root = model.root;
  const displayPeriod = root.userData.animationTiming?.authoredCyclePeriod ?? 10;
  const mechanismPeriod = root.userData.geometry?.mechanismCyclePeriod;
  const period = Number.isFinite(mechanismPeriod) && mechanismPeriod > 0
    ? Math.max(displayPeriod, mechanismPeriod) : displayPeriod;
  const effectiveVisible = (object) => {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  };
  const live = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position || object.isInstancedMesh) return;
    let named = object;
    while (named && !(named.userData.role || named.name)) named = named.parent;
    const label = named ? String(named.userData.role || named.name) : 'root';
    const role = named === object ? label : `${label}/${object.geometry.type}`;
    const translucent = [].concat(object.material ?? []).some((m) => m.transparent && (m.opacity ?? 1) < 0.6);
    live.push({ mesh: object, role, fluid: FLUID.test(role) || translucent, matrices: [], visible: [] });
  });
  const clusterTimes = Array.from({ length: 13 }, (_, i) => period * (i + 0.37) / 13);
  for (const time of clusterTimes) {
    model.update(time, period / 13); root.updateMatrixWorld(true);
    for (const item of live) { item.matrices.push(item.mesh.matrixWorld.clone()); item.visible.push(effectiveVisible(item.mesh)); }
  }
  for (const item of live) item.everVisible = item.visible.some(Boolean);
  const parent = live.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const box = new THREE.Box3().makeEmpty();
  for (const item of live) if (item.everVisible) {
    item.mesh.geometry.computeBoundingBox();
    box.union(item.mesh.geometry.boundingBox.clone().applyMatrix4(item.matrices[0]));
  }
  const diagonal = box.isEmpty() ? 10 : box.getSize(new THREE.Vector3()).length();
  const tol = 1e-6 * Math.max(1, diagonal);
  const relative = new THREE.Matrix4(), first = new THREE.Matrix4();
  for (let i = 0; i < live.length; i += 1) for (let j = i + 1; j < live.length; j += 1) {
    if (find(i) === find(j)) continue;
    first.copy(live[i].matrices[0]).invert().multiply(live[j].matrices[0]);
    let rigid = true;
    for (let k = 1; k < clusterTimes.length && rigid; k += 1) {
      relative.copy(live[i].matrices[k]).invert().multiply(live[j].matrices[k]);
      for (let e = 0; e < 16; e += 1) if (Math.abs(relative.elements[e] - first.elements[e]) > tol) { rigid = false; break; }
    }
    if (rigid) parent[find(i)] = find(j);
  }
  live.forEach((item, i) => { item.body = find(i); });
  const axisLines = [[new THREE.Vector3(), new THREE.Vector3(0, 1, 0)], [new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]];
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), rel = new THREE.Matrix4();
  const keepsAxis = (a, b) => axisLines.some(([o, d]) => {
    let ref = null;
    for (let k = 0; k < clusterTimes.length; k += 1) {
      rel.copy(b.matrices[k]).invert().multiply(a.matrices[k]);
      pa.copy(o).applyMatrix4(rel); pb.copy(d).applyMatrix4(rel);
      if (!ref) { ref = [pa.clone(), pb.clone()]; continue; }
      if (pa.distanceTo(ref[0]) > 1e-5 * diagonal || pb.distanceTo(ref[1]) > 1e-5 * diagonal) return false;
    }
    return true;
  });
  const spacing = requestedSpacing ?? Math.max(0.01, diagonal / 400);
  const prepared = new Map();
  const prepare = (item) => {
    const g = item.mesh.geometry, key = `${g.uuid}:${g.attributes.position.version}`;
    if (!prepared.has(key)) {
      const isClosed = closed(g);
      prepared.set(key, { points: densePoints(g, spacing), field: isClosed ? solidSurface(g) : null, closed: isClosed });
    }
    return prepared.get(key);
  };
  const inverse = new THREE.Matrix4(), toTarget = new THREE.Matrix4(), q = new THREE.Vector3(), localBox = new THREE.Box3();
  const depthInto = (source, target) => {
    const s = prepare(source), t = prepare(target);
    if (!t.field) return 0;
    inverse.copy(source.mesh.matrixWorld).invert();
    localBox.copy(t.field.box).applyMatrix4(target.mesh.matrixWorld).applyMatrix4(inverse).expandByScalar(spacing);
    toTarget.copy(target.mesh.matrixWorld).invert().multiply(source.mesh.matrixWorld);
    let worst = 0;
    for (const point of s.points) {
      if (!localBox.containsPoint(point)) continue;
      q.copy(point).applyMatrix4(toTarget);
      if (!t.field.box.containsPoint(q) || !t.field.inside(q)) continue;
      worst = Math.max(worst, t.field.distance(q));
    }
    return worst;
  };
  const candidates = live.filter((item) => item.everVisible);
  const pairs = new Map(), worldBoxes = new Map();
  for (let s = 0; s < samples; s += 1) {
    const time = period * s / (samples - 1);
    model.update(time, period / (samples - 1)); root.updateMatrixWorld(true);
    for (const item of candidates) {
      item.now = effectiveVisible(item.mesh);
      if (!item.now) continue;
      item.mesh.geometry.computeBoundingBox();
      worldBoxes.set(item, item.mesh.geometry.boundingBox.clone().applyMatrix4(item.mesh.matrixWorld));
    }
    for (let i = 0; i < candidates.length; i += 1) for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i], b = candidates[j];
      if (!a.now || !b.now || a.body === b.body) continue;
      if (!worldBoxes.get(a).intersectsBox(worldBoxes.get(b))) continue;
      const depth = Math.max(depthInto(a, b), depthInto(b, a));
      if (depth <= 0) continue;
      const kind = a.fluid || b.fluid ? 'fluid' : keepsAxis(a, b) || keepsAxis(b, a) ? 'coaxial' : 'solid';
      const key = `${a.role} x ${b.role}`;
      const previous = pairs.get(key);
      if (!previous || depth > previous.depth) pairs.set(key, { pair: key, kind, depth, time });
    }
  }
  const rows = [...pairs.values()].sort((x, y) => y.depth - x.depth);
  const count = (kind) => rows.filter((row) => row.kind === kind).length;
  const worst = (kind) => rows.find((row) => row.kind === kind)?.depth ?? 0;
  return {
    period, samples, spacing, diagonal,
    meshes: candidates.length,
    bodies: new Set(candidates.map((item) => item.body)).size,
    openMeshes: [...new Set(candidates.filter((item) => !prepare(item).closed).map((item) => item.role))],
    solidPairs: count('solid'), coaxialPairs: count('coaxial'),
    worstSolidDepth: worst('solid'), worstCoaxialDepth: worst('coaxial'),
    pairs: rows,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const ids = args.filter((arg) => /^\d+$/.test(arg)).map(Number);
  const { createGravityEscapementModel } = await import('./generate-gravity-escapement-plates.mjs');
  for (const id of ids.length ? ids : [309, 310, 311, 312]) {
    const result = probeBodyIntersections(await createGravityEscapementModel(id), {
      samples: Number(value('--samples') ?? 65),
      spacing: value('--spacing') === undefined ? undefined : Number(value('--spacing')),
    });
    console.log(`${id}: ${result.bodies} bodies, ${result.meshes} meshes, spacing ${result.spacing.toFixed(4)}; solid ${result.solidPairs} pairs (worst ${result.worstSolidDepth.toFixed(4)}), coaxial ${result.coaxialPairs} pairs (worst ${result.worstCoaxialDepth.toFixed(4)}); open ${result.openMeshes.length}`);
    if (args.includes('--pairs')) for (const p of result.pairs) console.log(`  ${p.kind.padEnd(8)} ${p.depth.toFixed(4)} @${p.time.toFixed(3)} ${p.pair}`);
    if (args.includes('--open')) console.log(`  open: ${result.openMeshes.join('; ')}`);
  }
}
