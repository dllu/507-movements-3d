// Disconnected-part screen. For each sampled phase, every visible solid mesh
// is measured against every other visible mesh by rendered-surface distance
// (dense surface samples against a triangle BVH, both directions, with an
// inside test so a pin buried in a closed hub counts as touching). From those
// gaps it reports:
//   detached  - components of the contact graph (edge: gap <= --touch)
//               other than the largest one, with the gap to the largest one
//               and the bridging pair; kind 'floating' when that gap exceeds
//               --connect, else 'near-miss' (a joint that visibly stops short);
//   nearMiss  - pairs that never touch but stay within --connect in every
//               phase, classified by their relative motion (hinge / rigid /
//               moving) and, for hinges, whether either mesh wraps around the
//               joint axis (a bore with clearance) or not (a link stopping
//               short of its pin);
//   openEnds  - tube / cylinder / lathe meshes whose open boundary loops are
//               not capped by another mesh (rod or leg ends left hollow).
// Ropes, cords, belts, chains, springs and other deforming meshes, plus fluid
// volumes, act as connectors: they join the graph but are never flagged.
// Thresholds are fractions of the model's bounding diagonal. This is triage
// evidence for visual review, not a certification of assembly.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as THREE from 'three';
import { densePoints } from '../tests/helpers/dense-points.mjs';
import { solidSurface } from '../tests/helpers/solid-surface.mjs';

const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
// Fluid volumes: translucent non-see-through materials, or roles naming a
// medium in a fluid state (column, volume, jet ...). Plain medium words are
// not enough: "water-wheel", "steam-cylinder" and "downstream-log" are solid.
export const FLUID = /meniscus|(water|steam|mercury|quicksilver|liquid|fluid|air|gas|oil)-(column|volume|load|payload|core|space|cavity|film|stream|jet|spray|flow|surface|seat-volume|in-|inside|under|between|through|returning|escaping|entering|filling|leaving|rising|falling|level|body|charge|fill|expelled|lifted|delivered|pumped|forced|drawn)|(^|-)(jets?|spray|plume|smoke|flame|particles?|bubbles?|drops|droplets?|sparks?|live-steam|exhaust-steam)(-|$)|ink-trace|traced?-(curve|path)|glow|shadow|envelope|highlight|ghost/i;
// A role ending in a medium word ("...-water") is fluid unless it names a
// solid carrying or standing in that medium ("pipe-standing-in-water").
const SOLID_NOUN = /(^|-)(rotating|stationary|sealed|above|receiving|standing|immersed|dipping|resting)(-|$)|(^|-)in-(water|steam|mercury|quicksilver|liquid)$/i;
export const isMediumSuffix = (role) => /(^|-)(water|steam|mercury|quicksilver|liquid)$/i.test(role) && !SOLID_NOUN.test(role);
export const isFluidRole = (role) => FLUID.test(role) || isMediumSuffix(role);
// A plain copy of a geometry's shape; custom geometry classes (laid rope)
// cannot be cloned without their constructor arguments.
// All instances of an InstancedMesh (e.g. generated gear teeth) as one
// geometry in the mesh's own frame, so the teeth join the part they belong to.
function mergeInstances(mesh) {
  const base = mesh.geometry.attributes.position, index = mesh.geometry.index;
  const count = mesh.count, m = new THREE.Matrix4(), v = new THREE.Vector3();
  const positions = new Float32Array(base.count * 3 * count);
  const indices = [];
  for (let c = 0; c < count; c += 1) {
    mesh.getMatrixAt(c, m);
    for (let i = 0; i < base.count; i += 1) {
      v.fromBufferAttribute(base, i).applyMatrix4(m);
      positions.set([v.x, v.y, v.z], (c * base.count + i) * 3);
    }
    if (index) for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i) + c * base.count);
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (index) merged.setIndex(indices);
  return merged;
}
function snapshotGeometry(geometry) {
  const copy = new THREE.BufferGeometry();
  copy.setAttribute('position', geometry.attributes.position.clone());
  if (geometry.index) copy.setIndex(geometry.index.clone());
  return copy;
}
export const CONNECTOR = /rope|cord|belt|chain|string|thong|cable|wire|band(?!-?saw)|thread(?!ed)|twine|line(?!ar|r)|tape|lash|spring|strap-?loop/i;
export const PINLIKE = /pin|pivot|stud|axle|shaft|arbor|bolt|rivet|journal|trunnion|gudgeon|fulcrum|eye|boss|collar|hub|bearing|knuckle|joint|wrist|shackle|crank-?pin|hinge/i;
export const DEFAULTS = { touch: 0.0015, connect: 0.012, figure: 0.04, phases: 6, spacing: 1 / 350, maxPoints: 5000 };

function expandIds(text) {
  return text.split(',').flatMap((part) => {
    const [a, b] = part.split('-').map(Number);
    return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
  });
}

// Undirected components of `n` nodes joined by `edges` ([i, j] pairs).
export function components(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const [i, j] of edges) parent[find(i)] = find(j);
  const groups = new Map();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

// Fraction of 12 angular bins about an axis line occupied by points whose
// radial distance is within `band` of the innermost one, restricted to an
// axial window. A bore around a pin covers most bins; a link end that stops
// short of its pin covers only a few.
export function angularCoverage(points, origin, axis, axial, band, THREE) {
  const u = axis.clone().normalize();
  const e1 = new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(e1)) > 0.8) e1.set(0, 1, 0);
  e1.sub(u.clone().multiplyScalar(u.dot(e1))).normalize();
  const e2 = u.clone().cross(e1);
  const d = new THREE.Vector3();
  const rows = [];
  for (const p of points) {
    d.copy(p).sub(origin);
    const s = d.dot(u);
    if (s < axial[0] || s > axial[1]) continue;
    const x = d.dot(e1), y = d.dot(e2);
    rows.push([Math.hypot(x, y), Math.atan2(y, x)]);
  }
  if (!rows.length) return { coverage: 0, radius: Infinity };
  const rmin = Math.min(...rows.map((r) => r[0]));
  const bins = new Set();
  for (const [r, a] of rows) if (r <= rmin + band) bins.add(Math.floor(((a + Math.PI) / (2 * Math.PI)) * 12) % 12);
  return { coverage: bins.size / 12, radius: rmin };
}

// Screens the production model (model-loader.js: baked MuJoCo routes and
// source presentation applied), not the synchronous registry fallback, which
// differs for the MuJoCo and baked movements. Baked data is fetched from disk.
async function worker(id, options) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const text = String(url?.url ?? url);
    if (text.startsWith('file:')) return new Response(await readFile(new URL(text)));
    if (text.startsWith('/')) return new Response(await readFile(`${root}public${text}`).catch(() => readFile(`${root}${text.slice(1)}`)));
    return realFetch(url, init);
  };
  const { loadMovementModel } = await import('../src/simulation/model-loader.js');
  const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;
  return screenModel(await loadMovementModel(catalog[id - 1]), id, options);
}

// Screens any model exposing { root, update(time, delta) }.
export function screenModel(model, id, options = DEFAULTS) {
  const root = model.root;
  const displayPeriod = root.userData.animationTiming?.authoredCyclePeriod ?? 10;
  const mechanismPeriod = root.userData.geometry?.mechanismCyclePeriod;
  const period = Number.isFinite(mechanismPeriod) && mechanismPeriod > 0 ? Math.max(displayPeriod, mechanismPeriod) : displayPeriod;
  const effectiveVisible = (object) => {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  };
  const materialsOf = (mesh) => [].concat(mesh.material ?? []);
  const items = [];
  let instanced = 0;
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position) return;
    if (object.isSkinnedMesh) return;
    if (object.isInstancedMesh) instanced += 1;
    let named = object;
    while (named && !(named.userData.role || named.name)) named = named.parent;
    const label = named ? String(named.userData.role || named.name) : 'root';
    const role = named === object ? label : `${label}/${object.geometry.type}`;
    const materials = materialsOf(object);
    const seeThrough = Boolean(object.userData.seeThrough || materials.some((m) => m.userData?.seeThrough));
    const translucent = materials.some((m) => m.transparent && (m.opacity ?? 1) < 0.8);
    const invisibleMaterial = materials.every((m) => m.visible === false || (m.opacity ?? 1) < 0.05 || m.colorWrite === false);
    const fluid = isFluidRole(role) || (translucent && !seeThrough);
    const rope = object.geometry.userData?.crossSection === 'laid-rope' || CONNECTOR.test(role);
    items.push({ mesh: object, index: items.length, role, fluid, rope, invisibleMaterial, instancedMesh: Boolean(object.isInstancedMesh), matrices: [], visible: [], geometries: [], versions: [], snapshots: [] });
  });

  const phases = options.phases;
  const times = Array.from({ length: phases }, (_, i) => period * (i + 0.21) / phases);
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  box.makeEmpty();
  for (const [k, time] of times.entries()) {
    model.update(time, period / phases); root.updateMatrixWorld(true);
    for (const item of items) {
      item.matrices.push(item.mesh.matrixWorld.clone());
      item.visible.push(effectiveVisible(item.mesh) && !item.invisibleMaterial);
      item.geometries.push(item.mesh.geometry);
      item.versions.push(item.instancedMesh ? `${item.mesh.geometry.attributes.position.version}:${item.mesh.instanceMatrix.version}:${item.mesh.count}` : item.mesh.geometry.attributes.position.version);
      // A deforming mesh (rope, sagging band, flexing water) is measured in
      // the shape it has at this phase, not the shape after the last update.
      const last = item.snapshots.at(-1);
      const changed = !last || item.geometries.at(-1) !== item.geometries.at(-2) || item.versions.at(-1) !== item.versions.at(-2);
      item.snapshots.push(changed ? (item.instancedMesh ? mergeInstances(item.mesh) : snapshotGeometry(item.mesh.geometry)) : last);
      if (k === 0 && item.visible[0] && !item.fluid) {
        const g = item.snapshots[0];
        g.computeBoundingBox();
        box.union(tmp.copy(g.boundingBox).applyMatrix4(item.mesh.matrixWorld));
      }
    }
  }
  const diagonal = box.isEmpty() ? 10 : box.getSize(new THREE.Vector3()).length();
  const touch = options.touch * diagonal, connect = options.connect * diagonal;
  const spacing = options.spacing * diagonal;
  const live = items.filter((item) => item.visible.some(Boolean));
  for (const item of live) {
    item.deforming = new Set(item.geometries).size > 1 || new Set(item.versions).size > 1;
    item.connector = item.fluid || item.rope || item.deforming;
  }
  // Fluid volumes neither join nor get flagged: a part touching only water is
  // still unsupported. Ropes, springs and deforming meshes do join.
  const graphable = (item) => !item.fluid;

  // Per-geometry surface samples and BVH (cached by geometry + version).
  const cache = new Map();
  const prepare = (item, k = 0) => {
    const g = item.snapshots[k] ?? item.mesh.geometry, key = g.uuid;
    if (!cache.has(key)) {
      let points = densePoints(g, spacing);
      if (points.length > options.maxPoints) {
        const stride = points.length / options.maxPoints;
        points = Array.from({ length: options.maxPoints }, (_, i) => points[Math.floor(i * stride)]);
      }
      const surface = solidSurface(g);
      cache.set(key, { points, surface, closed: isClosed(g) });
    }
    return cache.get(key);
  };
  const isClosed = (geometry) => boundaryEdges(geometry) === 0;
  const boundaryEdges = (geometry) => {
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
    let open = 0;
    for (const n of edges.values()) if (n === 1) open += 1;
    return edges.size ? open : Infinity;
  };

  // Directed gap: min over source samples of the target surface distance, in
  // world units (target scale is folded in; non-uniform scale uses the
  // smallest axis, which can only under-estimate the gap).
  const toTarget = new THREE.Matrix4(), q = new THREE.Vector3(), wp = new THREE.Vector3();
  const scaleOf = (m) => {
    const e = m.elements;
    const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
    return Math.min(sx, sy, sz);
  };
  const directed = (source, target, k, limit, worldBoxOfTarget) => {
    const s = prepare(source, k), t = prepare(target, k);
    toTarget.copy(target.matrices[k]).invert().multiply(source.matrices[k]);
    const scale = scaleOf(target.matrices[k]);
    let best = limit, where = null;
    const grown = worldBoxOfTarget.clone().expandByScalar(limit);
    for (const point of s.points) {
      wp.copy(point).applyMatrix4(source.matrices[k]);
      if (!grown.containsPoint(wp)) continue;
      q.copy(point).applyMatrix4(toTarget);
      const d = t.surface.distance(q, best / scale) * scale;
      if (d < best) { best = d; where = wp.clone(); }
    }
    return { gap: best, where };
  };
  const inside = (source, target, k) => {
    const s = prepare(source, k), t = prepare(target, k);
    if (!t.closed || !s.points.length) return false;
    toTarget.copy(target.matrices[k]).invert().multiply(source.matrices[k]);
    q.copy(s.points[0]).applyMatrix4(toTarget);
    return t.surface.inside(q);
  };

  const worldBox = (item, k) => {
    const g = item.snapshots[k] ?? item.mesh.geometry;
    g.computeBoundingBox();
    return g.boundingBox.clone().applyMatrix4(item.matrices[k]);
  };
  const n = live.length;
  // gaps[k] : Map "i:j" -> { gap, where }
  const gaps = Array.from({ length: phases }, () => new Map());
  for (let k = 0; k < phases; k += 1) {
    const boxes = live.map((item) => (item.visible[k] ? worldBox(item, k) : null));
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      if (!boxes[i] || !boxes[j]) continue;
      if (live[i].fluid && live[j].fluid) continue;
      const boxGap = boxDistance(boxes[i], boxes[j]);
      if (boxGap > connect) continue;
      const ab = directed(live[i], live[j], k, connect * 1.0001, boxes[j]);
      const ba = directed(live[j], live[i], k, Math.min(ab.gap, connect * 1.0001), boxes[i]);
      let best = ba.gap < ab.gap ? ba : ab;
      if (best.gap > touch && (inside(live[i], live[j], k) || inside(live[j], live[i], k))) best = { gap: 0, where: best.where, contained: true };
      if (best.gap <= connect) gaps[k].set(`${i}:${j}`, best);
    }
  }
  function boxDistance(a, b) {
    const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
    const dy = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y);
    const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
    return Math.hypot(dx, dy, dz);
  }

  const round = (x) => (Number.isFinite(x) ? Number(x.toFixed(4)) : null);
  const rel = (x) => (Number.isFinite(x) ? Number((x / diagonal).toFixed(5)) : null);
  // Relative-motion classification: rigid, hinge (fixed axis line), moving.
  const relMatrix = (a, b, k) => new THREE.Matrix4().copy(a.matrices[k]).invert().multiply(b.matrices[k]);
  const relation = (a, b) => {
    const base = relMatrix(a, b, 0);
    let rigid = true;
    const R = [];
    for (let k = 1; k < phases; k += 1) {
      const m = relMatrix(a, b, k);
      for (let e = 0; e < 16; e += 1) if (Math.abs(m.elements[e] - base.elements[e]) > 1e-6 * Math.max(1, diagonal)) rigid = false;
      R.push(m.multiply(base.clone().invert()));
    }
    if (rigid) return { kind: 'rigid' };
    // Largest relative rotation; solve its fixed axis line in a's frame.
    let bestAngle = 0, bestM = null;
    const quat = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
    for (const m of R) {
      m.decompose(pos, quat, scl);
      const angle = 2 * Math.acos(Math.min(1, Math.abs(quat.w)));
      if (angle > bestAngle) { bestAngle = angle; bestM = m; }
    }
    if (bestAngle < 1e-3) return { kind: 'moving' };
    bestM.decompose(pos, quat, scl);
    const s = Math.sqrt(Math.max(1e-12, 1 - quat.w * quat.w));
    const axis = new THREE.Vector3(quat.x / s, quat.y / s, quat.z / s).normalize();
    // Point on axis: least squares of (I - R) p = t over all phases.
    const solve = (m) => {
      const e1 = Math.abs(axis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      e1.sub(axis.clone().multiplyScalar(axis.dot(e1))).normalize();
      const e2 = axis.clone().cross(e1);
      const t = new THREE.Vector3().setFromMatrixPosition(m);
      const apply = (v) => v.clone().sub(v.clone().applyMatrix4(new THREE.Matrix4().extractRotation(m)));
      const a1 = apply(e1), a2 = apply(e2);
      const A = [[a1.dot(e1), a2.dot(e1)], [a1.dot(e2), a2.dot(e2)]];
      const b = [t.dot(e1), t.dot(e2)];
      const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
      if (Math.abs(det) < 1e-9) return null;
      const x = (b[0] * A[1][1] - A[0][1] * b[1]) / det, y = (A[0][0] * b[1] - A[1][0] * b[0]) / det;
      return e1.multiplyScalar(x).add(e2.multiplyScalar(y));
    };
    const p = solve(bestM);
    if (!p) return { kind: 'moving' };
    // Verify the axis line is fixed in every phase.
    for (const m of R) {
      const moved = p.clone().applyMatrix4(m), dir = axis.clone().transformDirection(m);
      if (moved.distanceTo(p) > 2e-3 * diagonal || Math.abs(Math.abs(dir.dot(axis)) - 1) > 1e-3) return { kind: 'moving' };
    }
    return { kind: 'hinge', axisLocal: axis, pointLocal: p };
  };

  // For a hinge pair at phase k: does the outer mesh wrap the joint axis
  // (a bore with clearance, or stacked eyes) or not (a link stopping short)?
  const jointOf = (a, b, r, k, gap) => {
    const origin = r.pointLocal.clone().applyMatrix4(a.matrices[k]);
    const axis = r.axisLocal.clone().transformDirection(a.matrices[k]);
    const worldPoints = (item) => prepare(item, k).points.map((p) => p.clone().applyMatrix4(item.matrices[k]));
    const pa = worldPoints(a), pb = worldPoints(b);
    const along = (pts) => pts.map((p) => p.clone().sub(origin).dot(axis));
    const sa = along(pa), sb = along(pb);
    const lo = Math.max(Math.min(...sa), Math.min(...sb)) - connect, hi = Math.min(Math.max(...sa), Math.max(...sb)) + connect;
    const band = Math.max(gap, touch) + 0.004 * diagonal;
    const ca = angularCoverage(pa, origin, axis, [lo, hi], band, THREE);
    const cb = angularCoverage(pb, origin, axis, [lo, hi], band, THREE);
    const outerWraps = (ca.radius > cb.radius ? ca : cb).coverage >= 0.75;
    return { joint: outerWraps ? 'bore-clearance' : 'short-of-pin', coverage: [round(ca.coverage), round(cb.coverage)],
      axisRadius: [round(ca.radius), round(cb.radius)] };
  };

  // Detached components per phase: the contact graph joins meshes whose gap
  // is within --touch; every component other than the largest one that holds
  // a non-connector mesh is reported with its gap to the largest component.
  const detached = new Map();
  for (let k = 0; k < phases; k += 1) {
    const ok = (i) => live[i].visible[k] && graphable(live[i]);
    // Ropes and springs lie in grooves or on pins with a little clearance,
    // so a connector joins within 3 x --touch.
    const edges = [...gaps[k]].filter(([key, { gap }]) => {
      const [i, j] = key.split(':').map(Number);
      return gap <= (live[i].connector || live[j].connector ? 3 : 1) * touch;
    }).map(([key]) => key.split(':').map(Number))
      .filter(([i, j]) => ok(i) && ok(j));
    const groups = components(n, edges).map((g) => g.filter(ok)).filter((g) => g.length)
      .sort((x, y) => y.length - x.length);
    if (groups.length < 2) continue;
    // Separate figures (plan beside elevation, paired views): components
    // whose world boxes lie within --figure of each other form one figure;
    // each figure's largest component is its main assembly.
    const boxes = groups.map((g) => g.reduce((acc, i) => acc.union(worldBox(live[i], k)), new THREE.Box3()));
    const figureEdges = [];
    for (let a = 0; a < groups.length; a += 1) for (let b = a + 1; b < groups.length; b += 1) {
      if (boxDistance(boxes[a], boxes[b]) <= options.figure * diagonal) figureEdges.push([a, b]);
    }
    const figures = components(groups.length, figureEdges);
    for (const figure of figures) {
    if (figure.length < 2) continue;
    figure.sort((a, b) => groups[b].length - groups[a].length);
    const main = new Set(groups[figure[0]]);
    for (const group of figure.slice(1).map((g) => groups[g])) {
      const flagged = group.filter((i) => !live[i].connector);
      if (!flagged.length) continue;
      let bestGap = Infinity, bestPair = null, where = null;
      const inGroup = new Set(group);
      for (const [key, entry] of gaps[k]) {
        const [i, j] = key.split(':').map(Number);
        const cross = (inGroup.has(i) && main.has(j)) || (inGroup.has(j) && main.has(i));
        if (cross && entry.gap < bestGap) { bestGap = entry.gap; bestPair = [i, j]; where = entry.where; }
      }
      if (!bestPair) {
        // Beyond --connect: bound by boxes, refine the closest few pairs.
        const candidates = [];
        for (const i of group) for (const j of main) candidates.push([boxDistance(worldBox(live[i], k), worldBox(live[j], k)), i, j]);
        candidates.sort((x, y) => x[0] - y[0]);
        for (const [bg, i, j] of candidates.slice(0, 12)) {
          if (bg >= bestGap) break;
          const limit = Math.max(connect * 30, bg * 2 + connect);
          const r1 = directed(live[i], live[j], k, limit, worldBox(live[j], k));
          const r2 = directed(live[j], live[i], k, limit, worldBox(live[i], k));
          const r = r1.gap < r2.gap ? r1 : r2;
          const g = Number.isFinite(r.gap) && r.gap < limit ? r.gap : bg;
          if (g < bestGap) { bestGap = g; bestPair = [i, j]; where = r.where; }
        }
      }
      const parts = [...new Set(flagged.map((i) => live[i].role))].sort();
      const key = parts.join(' + ');
      const previous = detached.get(key);
      const phasesSeparated = (previous?.phasesSeparated ?? 0) + 1;
      if (!previous || bestGap > previous.raw) {
        const [i, j] = bestPair ?? [flagged[0], flagged[0]];
        detached.set(key, { parts, raw: bestGap, gap: round(bestGap), gapRelative: rel(bestGap),
          kind: bestGap > connect ? 'floating' : 'near-miss', bridge: bestPair ? [live[i].role, live[j].role] : null,
          bridgeRelation: null,
          centers: flagged.slice(0, 8).map((f) => worldBox(live[f], k).getCenter(new THREE.Vector3()).toArray().map(round)),
          meshIndex: flagged.slice(0, 8).map((f) => live[f].index),
          pinlike: bestPair ? PINLIKE.test(live[i].role) || PINLIKE.test(live[j].role) : false,
          phase: round(times[k] / period), at: where ? where.toArray().map(round) : null, phasesSeparated });
        const row = detached.get(key);
        if (bestPair) {
          const r = relation(live[i], live[j]);
          row.bridgeRelation = r.kind;
          if (r.kind === 'hinge') Object.assign(row, jointOf(live[i], live[j], r, k, bestGap));
        }
      } else previous.phasesSeparated = phasesSeparated;
    }
    }
  }
  if (process.env.P74_DEBUG) {
    const rx = new RegExp(process.env.P74_DEBUG);
    live.forEach((item, i) => {
      if (!rx.test(item.role)) return;
      const near = [...gaps[0]].filter(([key]) => key.split(':').map(Number).includes(i))
        .map(([key, e]) => [live[key.split(':').map(Number).find((x) => x !== i)].role, round(e.gap)]);
      console.error(i, item.role, worldBox(item, 0).min.toArray().map(round), JSON.stringify(near));
    });
  }
  for (const row of detached.values()) row.persistent = row.phasesSeparated >= phases;

  const nearMiss = [];
  const allKeys = new Set();
  for (const map of gaps) for (const key of map.keys()) allKeys.add(key);
  for (const key of allKeys) {
    const [i, j] = key.split(':').map(Number);
    const a = live[i], b = live[j];
    if (a.connector || b.connector) continue;
    let minGap = Infinity, minK = -1, maxGap = 0, seen = 0, where = null;
    for (let k = 0; k < phases; k += 1) {
      if (!a.visible[k] || !b.visible[k]) continue;
      seen += 1;
      const entry = gaps[k].get(key);
      const g = entry ? entry.gap : Infinity;
      if (g < minGap) { minGap = g; minK = k; where = entry?.where ?? null; }
      maxGap = Math.max(maxGap, g);
    }
    if (!seen || !(minGap > touch) || !Number.isFinite(maxGap)) continue;
    const r = relation(a, b);
    const row = { parts: [a.role, b.role], relation: r.kind, gap: round(minGap), gapRelative: rel(minGap), maxGap: round(maxGap),
      phase: round(times[minK] / period), at: where ? where.toArray().map(round) : null,
      pinlike: PINLIKE.test(a.role) || PINLIKE.test(b.role) };
    if (r.kind === 'hinge') Object.assign(row, jointOf(a, b, r, minK, minGap));
    nearMiss.push(row);
  }
  nearMiss.sort((x, y) => (y.relation === 'hinge') - (x.relation === 'hinge') || y.gap - x.gap);

  // Open ends: boundary loops of tube / cylinder / lathe meshes. A loop is
  // capped when its centre lies within --touch of another visible mesh (an
  // end cap, a boss, the part it enters) or inside a closed one; otherwise
  // the hollow end of the rod or leg is exposed.
  const boundaryLoops = (geometry) => {
    const p = geometry.attributes.position, index = geometry.index, key = new Map(), pos = [], edges = new Map();
    const vid = (i) => {
      const k = `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
      if (!key.has(k)) { key.set(k, key.size); pos.push(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i))); }
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
    const open = [...edges].filter(([, n]) => n === 1).map(([e]) => e.split('_').map(Number));
    const loops = components(pos.length, open).filter((g) => g.length > 2);
    return loops.map((g) => {
      const c = new THREE.Vector3();
      for (const i of g) c.add(pos[i]);
      c.multiplyScalar(1 / g.length);
      const radius = Math.max(...g.map((i) => pos[i].distanceTo(c)));
      return { center: c, radius };
    });
  };
  const openEnds = [];
  const local = new THREE.Vector3();
  for (const item of live) {
    if (item.connector || !item.visible[0] || item.instancedMesh) continue;
    const type = item.mesh.geometry.type;
    if (!/Tube|Cylinder|Lathe|Capsule/.test(type)) continue;
    const loops = boundaryLoops(item.mesh.geometry);
    let exposed = 0, worst = 0, at = null;
    for (const loop of loops) {
      const world = loop.center.clone().applyMatrix4(item.matrices[0]);
      let best = Infinity;
      for (const other of live) {
        if (other === item || !other.visible[0] || other.fluid) continue;
        const t = prepare(other, 0);
        if (!worldBox(other, 0).expandByScalar(touch + loop.radius).containsPoint(world)) continue;
        local.copy(world).applyMatrix4(new THREE.Matrix4().copy(other.matrices[0]).invert());
        const d = t.closed && t.surface.inside(local) ? 0 : t.surface.distance(local) * scaleOf(other.matrices[0]);
        best = Math.min(best, d);
        if (best <= touch) break;
      }
      // A loop whose centre is near another surface is capped by it; the
      // radius term tolerates a cap seated on the rim rather than the centre.
      if (best > touch + 0.25 * loop.radius * scaleOf(item.matrices[0])) {
        exposed += 1;
        if (best > worst) { worst = best; at = world; }
      }
    }
    if (exposed) openEnds.push({ part: item.role, type, loops: loops.length, exposed,
      nearest: Number.isFinite(worst) ? round(worst) : null, at: at ? at.toArray().map(round) : null });
  }

  return {
    id, period, phases, diagonal: round(diagonal), touch: round(touch), connect: round(connect),
    meshes: live.length, connectors: live.filter((item) => item.connector).length, instanced,
    detached: [...detached.values()].map(({ raw, ...rest }) => rest).sort((x, y) => y.gap - x.gap),
    nearMiss: nearMiss.slice(0, 60), nearMissTotal: nearMiss.length,
    openEnds,
  };
}

function parseOptions() {
  const num = (name, fallback) => (value(name) === undefined ? fallback : Number(value(name)));
  return { touch: num('--touch', DEFAULTS.touch), figure: num('--figure', DEFAULTS.figure), connect: num('--connect', DEFAULTS.connect), phases: num('--phases', DEFAULTS.phases),
    spacing: num('--spacing', DEFAULTS.spacing), maxPoints: num('--max-points', DEFAULTS.maxPoints) };
}


const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && value('--worker')) {
  const result = await worker(Number(value('--worker')), parseOptions());
  console.log(JSON.stringify(result));
} else if (isMain) {
  for (const arg of args) if (!/^--(ids|out|timeout-ms|jobs|touch|figure|connect|phases|spacing|max-points|max-old-space-size)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const ids = expandIds(value('--ids') ?? '1-507');
  const timeout = Number(value('--timeout-ms') ?? 900000);
  const jobs = Number(value('--jobs') ?? 1);
  const heap = value('--max-old-space-size') ?? '6144';
  const out = resolve(value('--out') ?? '/dev/shm/507-disconnected-parts.json');
  const extra = args.filter((arg) => /^--(touch|figure|connect|phases|spacing|max-points)=/.test(arg));
  let report = { generatedAt: new Date().toISOString(), options: parseOptions(),
    scope: 'Rendered-surface gaps between visible meshes at sampled phases; connectors (ropes, belts, springs, deforming meshes, fluids) join but are not flagged; triage for visual review.', movements: [] };
  try {
    const previous = JSON.parse(await readFile(out, 'utf8'));
    if (previous?.movements) report.movements = previous.movements.filter((m) => !ids.includes(m.id));
  } catch { /* fresh report */ }
  await mkdir(dirname(out), { recursive: true });
  const queue = [...ids];
  const run = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      let result;
      const started = Date.now();
      try {
        const { stdout } = await promisify(execFile)(process.execPath, [`--max-old-space-size=${heap}`, fileURLToPath(import.meta.url), `--worker=${id}`, ...extra], { timeout, maxBuffer: 64 * 1024 * 1024 });
        result = JSON.parse(stdout.trim().split('\n').at(-1));
      } catch (error) {
        result = { id, status: error.killed ? 'timeout' : 'error', error: String(error.stderr || error.message).slice(0, 800) };
      }
      result.seconds = Math.round((Date.now() - started) / 1000);
      report.movements = report.movements.filter((m) => m.id !== id).concat(result).sort((a, b) => a.id - b.id);
      await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
      const hinge = result.nearMiss?.filter((row) => row.joint === 'short-of-pin').length ?? 0;
      console.log(`${id}: ${result.status ?? `${result.meshes} meshes; detached ${result.detached.length} (floating ${result.detached.filter((row) => row.kind === 'floating').length}), near-miss pairs ${result.nearMissTotal} (short-of-pin ${hinge}), open ends ${result.openEnds.length}`} ${result.seconds}s`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, run));
}
