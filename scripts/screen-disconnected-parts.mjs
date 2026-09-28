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
//               not capped by another mesh (rod or leg ends left hollow);
//   slivers   - joints that touch or overlap, but by a patch that is tiny
//               against the parts' sections, where that joint is the only
//               structural connection (see sliverScreen; --sliver=0 skips,
//               --sliver-all=1 also lists the unflagged attachments);
//   lips      - rod or arm ends that overhang the boss they run into by a
//               small step (see lipScreen).
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
export function mergeInstances(mesh) {
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
export function snapshotGeometry(geometry) {
  const copy = new THREE.BufferGeometry();
  copy.setAttribute('position', geometry.attributes.position.clone());
  // Honour the draw range: dynamic meshes (e.g. steam volumes) shrink it and
  // leave stale triangles from earlier frames beyond it in their buffers.
  const { start, count } = geometry.drawRange;
  const total = geometry.index ? geometry.index.count : geometry.attributes.position.count;
  const end = Math.min(total, Number.isFinite(count) ? start + count : total);
  if (start > 0 || end < total) {
    const source = geometry.index?.array;
    const indices = new Uint32Array(Math.max(0, end - start));
    for (let i = start; i < end; i += 1) indices[i - start] = source ? source[i] : i;
    copy.setIndex(new THREE.BufferAttribute(indices, 1));
  } else if (geometry.index) copy.setIndex(geometry.index.clone());
  return copy;
}
export const CONNECTOR = /rope|cord|belt|chain|string|thong|cable|wire|band(?!-?saw)|thread(?!ed)|twine|line(?!ar|r)|tape|lash|spring|strap-?loop/i;
export const PINLIKE = /pin|pivot|stud|axle|shaft|arbor|bolt|rivet|journal|trunnion|gudgeon|fulcrum|eye|boss|collar|hub|bearing|knuckle|joint|wrist|shackle|crank-?pin|hinge/i;
export const DEFAULTS = { touch: 0.0015, connect: 0.012, figure: 0.04, phases: 6, spacing: 1 / 350, maxPoints: 5000 };

export function expandIds(text) {
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
  return screenModel(await loadProductionModel(id), id, options);
}

// Loads movement `id` as the browser does (model-loader.js), serving the
// baked data files from disk. Shared with screen-coincident-faces.mjs.
export async function loadProductionModel(id) {
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
  return loadMovementModel(catalog[id - 1]);
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

  const { slivers, lips, structuralJoints, attachmentsMeasured, attachmentsExcluded } = options.sliver === false
    ? { slivers: [], lips: [], structuralJoints: 0, attachmentsMeasured: 0, attachmentsExcluded: 0 }
    : sliverScreen({ live, gaps, phases, times, period, touch, diagonal, spacing, options, relation, prepare, worldBox, scaleOf, round });

  return {
    id, period, phases, diagonal: round(diagonal), touch: round(touch), connect: round(connect),
    meshes: live.length, connectors: live.filter((item) => item.connector).length, instanced,
    detached: [...detached.values()].map(({ raw, ...rest }) => rest).sort((x, y) => y.gap - x.gap),
    nearMiss: nearMiss.slice(0, 60), nearMissTotal: nearMiss.length,
    openEnds,
    structuralJoints, attachmentsMeasured, attachmentsExcluded, slivers, lips,
  };
}

// Ranges of a point cloud along its principal axes, largest first, with the
// axes (Jacobi eigen-decomposition of the covariance).
export function principalExtents(points) {
  if (!points.length) return { extents: [0, 0, 0], axes: [], center: null };
  const c = [0, 0, 0];
  for (const p of points) { c[0] += p.x; c[1] += p.y; c[2] += p.z; }
  c.forEach((_, i) => { c[i] /= points.length; });
  const a = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) {
    const d = [p.x - c[0], p.y - c[1], p.z - c[2]];
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) a[i][j] += d[i] * d[j];
  }
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep += 1) {
    let off = 0;
    for (let p = 0; p < 3; p += 1) for (let q = p + 1; q < 3; q += 1) off += a[p][q] ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < 3; p += 1) for (let q = p + 1; q < 3; q += 1) {
      if (Math.abs(a[p][q]) < 1e-30) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const cs = 1 / Math.sqrt(t * t + 1), sn = t * cs;
      for (let k = 0; k < 3; k += 1) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = cs * akp - sn * akq; a[k][q] = sn * akp + cs * akq;
      }
      for (let k = 0; k < 3; k += 1) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = cs * apk - sn * aqk; a[q][k] = sn * apk + cs * aqk;
      }
      for (let k = 0; k < 3; k += 1) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = cs * vkp - sn * vkq; v[k][q] = sn * vkp + cs * vkq;
      }
    }
  }
  const axes = [0, 1, 2].map((i) => new THREE.Vector3(v[0][i], v[1][i], v[2][i]).normalize());
  const rows = axes.map((axis) => {
    let lo = Infinity, hi = -Infinity;
    for (const p of points) {
      const s = (p.x - c[0]) * axis.x + (p.y - c[1]) * axis.y + (p.z - c[2]) * axis.z;
      if (s < lo) lo = s; if (s > hi) hi = s;
    }
    return [hi - lo, axis];
  }).sort((x, y) => y[0] - x[0]);
  return { extents: rows.map((r) => r[0]), axes: rows.map((r) => r[1]), center: new THREE.Vector3(...c) };
}

// A patch that rings an axis (a bore on a shaft, an eye on a pin, a hub on
// an arbor): the fraction of 12 angular bins, about the best principal axis,
// holding points of a hollow band (inner radius over 0.35 of the outer).
export function ringCoverage(all, principal = principalExtents(all)) {
  if (all.length < 12) return 0;
  const points = all.length > 6000 ? Array.from({ length: 6000 }, (_, i) => all[Math.floor(i * all.length / 6000)]) : all;
  let best = 0;
  for (const axis of principal.axes) {
    const e1 = new THREE.Vector3(1, 0, 0);
    if (Math.abs(axis.dot(e1)) > 0.8) e1.set(0, 1, 0);
    e1.sub(axis.clone().multiplyScalar(axis.dot(e1))).normalize();
    const e2 = axis.clone().cross(e1), d = new THREE.Vector3();
    const rows = points.map((p) => { d.copy(p).sub(principal.center); const x = d.dot(e1), y = d.dot(e2); return [Math.hypot(x, y), Math.atan2(y, x)]; });
    const rmax = rows.reduce((m, r) => Math.max(m, r[0]), 0);
    if (!(rmax > 0)) continue;
    // Hollow: nearly no points near the axis.
    const innerShare = rows.filter((r) => r[0] < 0.35 * rmax).length / rows.length;
    if (innerShare > 0.02) continue;
    const bins = new Set(rows.map(([, a]) => Math.floor(((a + Math.PI) / (2 * Math.PI)) * 12) % 12));
    best = Math.max(best, bins.size / 12);
  }
  return best;
}

export const SLIVER_DEFAULTS = { sliverNeck: 0.35, sliverArea: 0.25, sliverCap: 0.5, sliverWide: 0.1, sliverEmbed: 0.5, sliverTol: 0.0003, lipStep: 0.3, lipMin: 0.0015 };
// Sheets and scenery that rest on or wrap a part rather than being joined to
// it; and, for joints that are not rigid, roles naming a designed bearing or
// working contact (a pintle seated in a cup, a pad against a lever).
export const SLIVER_SHEET = /cloth|warp|fabric|paper|leather|canvas/i;
export const SLIVER_SCENERY = /(^|-)(river|stream|sea|ground|earth|terrain|soil|pavement|road)(-|$)/i;
export const SLIVER_WORKING = /contact|touching|resting|seated|against|pintle|pivot-point|knife-edge/i;

// Sliver joints: parts that touch or overlap, but only by a sliver.
// A structural joint is a pair of solid meshes that touch (gap <= --touch)
// in every sampled phase and either move rigidly together, turn about a
// hinge whose axis passes through their contact (a pin in an eye, not a
// pawl tip on a fixed ratchet), or keep the same contact spot in both
// bodies' frames (a ball joint). Working contacts (pawls on teeth, sliders
// in guides, gear teeth, cams, intermittent drives) fail those tests and are
// not joints. In the graph of structural joints plus rope/belt/spring links,
// each attachment that is the ONLY structural connection between two sides
// (a bridge, or one mesh held by two or three touching neighbours, like a
// crank arm standing on a shaft and its hub) is measured at fine sampling:
//   neck   - principal extents of the contact patch (the surface of either
//            mesh within the pair gap + --sliver-tol x diagonal of, or
//            inside, the other; the smaller of the two sides' patches);
//   section- each member's local cross-section at the joint (principal
//            extents of its surface within ~1.5 of its thickness);
//   depth  - the deepest sample of either mesh inside the other.
// Attachments whose patch rings an axis (a hub on a shaft, an eye on a pin)
// or whose depth reaches --sliver-embed of the thinner section (a pin set
// into a hole) are solid. Otherwise the attachment is a sliver when
//   narrow-neck: neck width < --sliver-neck x the thinner member's width,
//   small-patch: neck area < --sliver-area x its section area, or
//   cap:         neck area < --sliver-cap x the thinner section AND
//                < --sliver-wide x the wider member's section (a ball or a
//                block hung from a stem end by a small cap of its surface).
// Fluids never join; ropes, belts and springs join the graph but their
// attachments are not measured; sheets and scenery (SLIVER_SHEET,
// SLIVER_SCENERY) are skipped, as are non-rigid joints whose roles name a
// designed bearing or working contact (SLIVER_WORKING).
function sliverScreen(ctx) {
  const { live, gaps, phases, times, period, touch, diagonal, spacing, options, relation, prepare, worldBox, scaleOf, round } = ctx;
  const o = { ...SLIVER_DEFAULTS, ...options };
  const n = live.length;
  const keyOf = (i, j) => (i < j ? `${i}:${j}` : `${j}:${i}`);
  const worldPts = (item, k) => prepare(item, k).points.map((p) => p.clone().applyMatrix4(item.matrices[k]));
  const extentCache = new Map();
  const globalExtents = (item, k) => {
    const key = `${item.index}:${(item.snapshots[k] ?? item.mesh.geometry).uuid}`;
    if (!extentCache.has(key)) extentCache.set(key, principalExtents(worldPts(item, k)).extents);
    return extentCache.get(key);
  };
  const inv = (m) => new THREE.Matrix4().copy(m).invert();
  // Coarse patch (cached samples) of a against b and b against a.
  const coarsePatch = (a, b, k, tol) => {
    const out = [];
    for (const [x, y] of [[a, b], [b, a]]) {
      const ty = prepare(y, k), toY = inv(y.matrices[k]).multiply(x.matrices[k]), sy = scaleOf(y.matrices[k]);
      const box = worldBox(y, k).expandByScalar(tol), w = new THREE.Vector3(), q = new THREE.Vector3();
      for (const p of prepare(x, k).points) {
        w.copy(p).applyMatrix4(x.matrices[k]);
        if (!box.containsPoint(w)) continue;
        q.copy(p).applyMatrix4(toY);
        const d = ty.surface.distance(q, tol / sy) * sy;
        if (d <= tol || (ty.closed && ty.surface.inside(q))) out.push(w.clone());
      }
    }
    return out;
  };
  const centroid = (points) => points.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, points.length));

  // 1. Structural joints.
  const joints = new Map();
  const allKeys = new Set();
  for (const map of gaps) for (const key of map.keys()) allKeys.add(key);
  for (const key of allKeys) {
    const [i, j] = key.split(':').map(Number);
    const a = live[i], b = live[j];
    if (a.fluid || b.fluid || a.connector || b.connector) continue;
    let seen = 0, persistent = true;
    for (let k = 0; k < phases; k += 1) {
      if (!a.visible[k] || !b.visible[k]) continue;
      seen += 1;
      if (!(gaps[k].get(key)?.gap <= touch)) { persistent = false; break; }
    }
    if (!seen || !persistent) continue;
    const r = relation(a, b);
    let structural = r.kind === 'rigid', why = r.kind;
    if (!structural) {
      const ks = [...Array(phases).keys()].filter((k) => a.visible[k] && b.visible[k]);
      const cents = ks.map((k) => centroid(coarsePatch(a, b, k, touch)));
      const ea = globalExtents(a, ks[0]), eb = globalExtents(b, ks[0]);
      const thin = Math.min(ea[2], eb[2]), mid = Math.min(ea[1], eb[1]);
      if (r.kind === 'hinge') {
        // The contact lies on the hinge axis (pin in eye), not out at a
        // working face (a pawl tip on a fixed ratchet).
        const worst = Math.max(...ks.map((k, m) => {
          const origin = r.pointLocal.clone().applyMatrix4(a.matrices[k]);
          const axis = r.axisLocal.clone().transformDirection(a.matrices[k]);
          const d = cents[m].clone().sub(origin);
          return d.sub(axis.multiplyScalar(d.dot(axis))).length();
        }));
        structural = worst <= 0.75 * mid + touch;
        why = structural ? 'hinge' : 'hinge-working-face';
      } else {
        // Same contact spot in both bodies' frames (ball joint), not a
        // sliding or rolling contact whose spot travels.
        const drift = (item) => {
          const local = ks.map((k, m) => cents[m].clone().applyMatrix4(inv(item.matrices[k])).multiplyScalar(scaleOf(item.matrices[k])));
          const c = centroid(local);
          return Math.max(...local.map((p) => p.distanceTo(c)));
        };
        structural = Math.max(drift(a), drift(b)) <= Math.max(2 * touch, 0.25 * thin);
        why = structural ? 'fixed-spot' : 'working';
      }
    }
    if (structural) joints.set(key, { i, j, relation: r.kind, why });
  }

  // 2. Attachments: at each phase, for every mesh v and every component C
  // of the structural graph with v removed, the joints between v and C are
  // the only structural connection between C and v's side. A single joint is
  // a bridge; a mesh can also be held by two or three touching neighbours
  // that are themselves joined (a crank arm standing on a shaft and its hub),
  // which is measured as one joint. Attachments through a rope, belt or
  // spring are not measured.
  const cuts = new Map();
  for (let k = 0; k < phases; k += 1) {
    const ok = (i) => live[i].visible[k] && !live[i].fluid;
    const adjacency = Array.from({ length: n }, () => []);
    const add = (i, j, key) => { adjacency[i].push([j, key]); adjacency[j].push([i, key]); };
    const seenEdge = new Set();
    for (const [key, joint] of joints) if (ok(joint.i) && ok(joint.j)) { seenEdge.add(key); add(joint.i, joint.j, key); }
    for (const [key, { gap }] of gaps[k]) {
      const [i, j] = key.split(':').map(Number);
      if (seenEdge.has(key) || !ok(i) || !ok(j) || !(live[i].connector || live[j].connector)) continue;
      if (gap <= 3 * touch) add(i, j, null);
    }
    // Component labels of the whole graph and of the graph without v.
    const label = (skip) => {
      const out = new Array(n).fill(-1);
      let c = 0;
      for (let s0 = 0; s0 < n; s0 += 1) {
        if (s0 === skip || out[s0] >= 0 || !ok(s0)) continue;
        const stack = [s0]; out[s0] = c;
        while (stack.length) {
          const x = stack.pop();
          for (const [y] of adjacency[x]) if (y !== skip && out[y] < 0) { out[y] = c; stack.push(y); }
        }
        c += 1;
      }
      return out;
    };
    const whole = label(-1);
    const sizeOf = (labels, c) => labels.reduce((m, l, x) => m + (l === c && x !== undefined ? 1 : 0), 0);
    for (let v = 0; v < n; v += 1) {
      if (!ok(v) || live[v].connector || !adjacency[v].length) continue;
      const without = label(v);
      const byComponent = new Map();
      for (const [u, key] of adjacency[v]) {
        const c = without[u];
        if (!byComponent.has(c)) byComponent.set(c, []);
        byComponent.get(c).push([u, key]);
      }
      const total = sizeOf(whole, whole[v]);
      for (const [c, list] of byComponent) {
        if (list.length > 3 || list.some(([u, key]) => !key || live[u].connector)) continue;
        const cutKey = list.map(([, key]) => key).sort().join('|');
        if (!cuts.has(cutKey)) {
          const cSize = sizeOf(without, c), vSide = total - cSize;
          const members = (cSize <= vSide ? [...without.keys()].filter((x) => without[x] === c)
            : [...whole.keys()].filter((x) => whole[x] === whole[v] && without[x] !== c));
          cuts.set(cutKey, { v, us: list.map(([u]) => u), keys: list.map(([, key]) => key), phases: [],
            held: cSize <= vSide ? 'far' : 'v', holds: members.map((x) => live[x].role) });
        }
        cuts.get(cutKey).phases.push(k);
      }
    }
  }

  // 3. Fine measurement of each bridging joint.
  const triCache = new Map();
  const trianglesOf = (item, k) => {
    const g = item.snapshots[k] ?? item.mesh.geometry;
    if (!triCache.has(g.uuid)) {
      const p = g.attributes.position, index = g.index, list = [];
      for (let t = 0; t < (index?.count ?? p.count); t += 3) {
        const v = [0, 1, 2].map((m) => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(t + m) : t + m));
        const tri = new THREE.Triangle(...v);
        const area = tri.getArea();
        if (area > 1e-16) list.push({ v, box: new THREE.Box3().setFromPoints(v), area, normal: tri.getNormal(new THREE.Vector3()) });
      }
      triCache.set(g.uuid, list);
    }
    return triCache.get(g.uuid);
  };
  const localBox = (worldBoxValue, matrix) => {
    const m = inv(matrix), out = new THREE.Box3(), c = new THREE.Vector3();
    for (let b = 0; b < 8; b += 1) {
      c.set(b & 1 ? worldBoxValue.max.x : worldBoxValue.min.x, b & 2 ? worldBoxValue.max.y : worldBoxValue.min.y, b & 4 ? worldBoxValue.max.z : worldBoxValue.min.z);
      out.expandByPoint(c.applyMatrix4(m));
    }
    return out;
  };
  // Samples (world points + world normals) of `item`'s triangles meeting a
  // world box, at a world step, capped at `cap` samples.
  const sampleRegion = (item, k, region, step, cap = 30000) => {
    const scale = scaleOf(item.matrices[k]), lb = localBox(region, item.matrices[k]);
    const tris = trianglesOf(item, k).filter((t) => t.box.intersectsBox(lb));
    const area = tris.reduce((s, t) => s + t.area, 0) * scale * scale;
    const worldStep = Math.max(step, Math.sqrt(area / cap));
    const localStep = worldStep / scale, points = [], normals = [];
    const nm = new THREE.Matrix3().getNormalMatrix(item.matrices[k]);
    const start = new THREE.Vector3();
    for (const t of tris) {
      const [a0, b0, c0] = t.v;
      const edges = [[a0, b0, c0], [b0, c0, a0], [c0, a0, b0]];
      const [p, q, apex] = edges.reduce((best, e) => (e[0].distanceTo(e[1]) > best[0].distanceTo(best[1]) ? e : best));
      const length = p.distanceTo(q), height = 2 * t.area / length;
      const along = Math.max(1, Math.ceil(length / localStep)), across = Math.max(1, Math.ceil(height / localStep));
      const normal = t.normal.clone().applyMatrix3(nm).normalize();
      for (let j = 0; j <= across; j += 1) {
        const s = j / across, count = Math.max(1, Math.ceil(along * (1 - s)));
        for (let i = 0; i <= count; i += 1) {
          start.lerpVectors(p, q, i / count);
          const w = start.clone().lerp(apex, s).applyMatrix4(item.matrices[k]);
          if (!region.containsPoint(w)) continue;
          points.push(w); normals.push(normal);
        }
      }
    }
    return { points, normals, step: worldStep };
  };
  const localSection = (item, k, at, rho, step) => {
    const region = new THREE.Box3().setFromCenterAndSize(at, new THREE.Vector3(2 * rho, 2 * rho, 2 * rho));
    const { points } = sampleRegion(item, k, region, step, 12000);
    const near = points.filter((p) => p.distanceTo(at) <= rho);
    return principalExtents(near).extents;
  };
  // Contact patches of one joint: each side's surface samples within the
  // pair gap + --sliver-tol of the other, or inside it (closed meshes), and
  // the deepest inside sample. Cached per pair and phase.
  const patchCache = new Map();
  const patches = (a, b, k) => {
    const key = `${keyOf(live.indexOf(a), live.indexOf(b))}@${k}`;
    if (patchCache.has(key)) {
      const hit = patchCache.get(key);
      return hit.first === a ? hit.value : { ...hit.value, sides: [hit.value.sides[1], hit.value.sides[0]] };
    }
    const gap = gaps[k].get(keyOf(live.indexOf(a), live.indexOf(b)))?.gap ?? 0;
    const tol = Math.max(0, gap) + o.sliverTol * diagonal;
    const ga = globalExtents(a, k), gb = globalExtents(b, k);
    const step = Math.max(diagonal / 6000, Math.min(spacing / 2, Math.min(ga[2], gb[2]) / 16));
    const region = worldBox(a, k).intersect(worldBox(b, k).expandByScalar(tol)).expandByScalar(tol);
    const sides = [];
    let depth = 0;
    for (const [x, y] of [[a, b], [b, a]]) {
      if (region.isEmpty()) { sides.push({ patch: [], step }); continue; }
      const ty = prepare(y, k), toY = inv(y.matrices[k]), sy = scaleOf(y.matrices[k]);
      const { points, step: used } = sampleRegion(x, k, region, step);
      const patch = [], q = new THREE.Vector3();
      for (const w of points) {
        q.copy(w).applyMatrix4(toY);
        const d = ty.surface.distance(q, (tol * 1.01) / sy) * sy;
        if (d <= tol) { patch.push(w); continue; }
        if (ty.closed && ty.surface.inside(q)) {
          patch.push(w);
          depth = Math.max(depth, ty.surface.distance(q, (0.2 * diagonal) / sy) * sy);
        }
      }
      sides.push({ patch, step: used });
    }
    const value = { gap, sides, depth, step };
    patchCache.set(key, { first: a, value });
    return value;
  };
  const describe = (patch, step) => {
    const pe = principalExtents(patch);
    return { patch, extents: pe.extents.map((e) => (patch.length ? e + step : 0)), wrap: ringCoverage(patch, pe) };
  };
  // A cut: mesh v joined to meshes us. The neck is the smaller (by principal
  // area) of v's union patch and the union of the neighbours' patches.
  const measure = (v, us, k) => {
    const vPatch = [], uPatch = [], perU = [];
    let depth = 0, step = Infinity, gap = 0;
    for (const u of us) {
      const m = patches(v, u, k);
      for (const w of m.sides[0].patch) vPatch.push(w);
      for (const w of m.sides[1].patch) uPatch.push(w);
      perU.push([u, m.sides[1].patch]);
      depth = Math.max(depth, m.depth); step = Math.min(step, m.sides[0].step, m.sides[1].step); gap = Math.max(gap, m.gap);
    }
    const sides = [describe(vPatch, step), describe(uPatch, step)];
    const neckSide = sides.reduce((best, x) => (x.extents[0] * x.extents[1] < best.extents[0] * best.extents[1] ? x : best));
    const all = vPatch.concat(uPatch);
    if (!all.length) return null;
    const at = centroid(all);
    const sections = [[v, at], ...perU.map(([u, p]) => [u, p.length ? centroid(p) : at])].map(([item, where]) => {
      const g = globalExtents(item, k);
      return localSection(item, k, where, 1.5 * g[2] + neckSide.extents[0] / 2, step);
    });
    const width = Math.min(...sections.map((x) => x[2] || Infinity));
    const area = Math.min(...sections.map((x) => (x[1] * x[2]) || Infinity));
    return { gap, neck: neckSide.extents.slice(0, 2), sections, width, area, depth, points: neckSide.patch.length, at, step,
      wrap: Math.max(...sides.map((x) => x.wrap)) };
  };

  const slivers = [];
  let excluded = 0;
  for (const cut of cuts.values()) {
    const v = live[cut.v], us = cut.us.map((u) => live[u]);
    const roles = [v, ...us].map((item) => item.role);
    const rigidOnly = cut.keys.every((key) => joints.get(key).relation === 'rigid');
    if (roles.some((role) => SLIVER_SHEET.test(role) || SLIVER_SCENERY.test(role))
      || (!rigidOnly && roles.some((role) => SLIVER_WORKING.test(role)))) { excluded += 1; continue; }
    const sample = rigidOnly ? [cut.phases[0]] : [...new Set(cut.phases)];
    let worst = null;
    for (const k of sample) {
      const m = measure(v, us, k);
      if (!m || !Number.isFinite(m.width)) continue;
      m.k = k;
      m.neckRatio = m.neck[1] / m.width;
      m.areaRatio = (m.neck[0] * m.neck[1]) / m.area;
      // Neck area against the wider member's section: a ball or block hung
      // from the end of a stem by a small cap of its surface.
      m.wideRatio = (m.neck[0] * m.neck[1]) / Math.max(...m.sections.map((x) => x[1] * x[2]));
      m.depthRatio = m.depth / m.width;
      m.state = m.points === 0 ? 'unmeasured' : m.wrap >= 0.75 ? 'wrapped' : m.depthRatio >= o.sliverEmbed ? 'embedded' : 'open';
      m.score = m.state !== 'open' ? Infinity
        : Math.min(m.neckRatio / o.sliverNeck, m.areaRatio / o.sliverArea, Math.max(m.areaRatio / o.sliverCap, m.wideRatio / o.sliverWide));
      if (!worst || m.score < worst.score) worst = m;
    }
    if (!worst) continue;
    const reasons = [];
    if (worst.state === 'open') {
      if (worst.neckRatio < o.sliverNeck) reasons.push('narrow-neck');
      if (worst.areaRatio < o.sliverArea) reasons.push('small-patch');
      if (worst.areaRatio < o.sliverCap && worst.wideRatio < o.sliverWide) reasons.push('cap');
    }
    const relations = [...new Set(cut.keys.map((key) => joints.get(key).why))];
    slivers.push({ parts: roles, joints: cut.keys.length, relation: relations.join('+'), flagged: reasons.length > 0, reasons, state: worst.state,
      score: Number.isFinite(worst.score) ? round(worst.score) : null, neck: worst.neck.map(round), neckRatio: round(worst.neckRatio), areaRatio: round(worst.areaRatio),
      wideRatio: round(worst.wideRatio), sectionWidth: round(worst.width), sectionArea: round(worst.area), depth: round(worst.depth), depthRatio: round(worst.depthRatio),
      sections: worst.sections.map((sec) => sec.map(round)), wrap: round(worst.wrap),
      gap: round(worst.gap), patchPoints: worst.points, step: round(worst.step),
      phase: round(times[worst.k] / period), cutPhases: cut.phases.length, at: worst.at.toArray().map(round),
      holds: cut.holds.slice(0, 8), holdsCount: cut.holds.length });
  }
  // Repeated parts with one role (twelve teeth, four blades) collapse into
  // their worst row.
  const unique = new Map();
  for (const row of slivers.sort((x, y) => (x.score ?? Infinity) - (y.score ?? Infinity))) {
    const key = row.parts.join('|');
    if (unique.has(key)) unique.get(key).repeats += 1;
    else unique.set(key, Object.assign(row, { repeats: 1 }));
  }
  slivers.length = 0;
  slivers.push(...unique.values());
  slivers.sort((x, y) => (x.score ?? Infinity) - (y.score ?? Infinity));
  const lips = lipScreen({ ...ctx, o, joints, globalExtents, sampleRegion, worldPts });
  return { slivers: slivers.filter((r) => r.flagged).concat(o.sliverAll ? slivers.filter((r) => !r.flagged) : []), lips,
    structuralJoints: joints.size, attachmentsMeasured: slivers.length, attachmentsExcluded: excluded };
}

// Overhang lips. For every elongated mesh (a rod, arm or lever: longest
// principal extent at least 3x the next) whose end runs into rigidly joined
// meshes (a boss, hub or eye), compare the rod's cross-section just outside
// the entry with the joined meshes' outline over the entered length, along
// the rod's two cross-section axes (v along the joined meshes' thinnest
// direction). A rod face standing proud of the joined outline by under
// --lip-step of the rod's width is an overhang lip (the 100 tail rod, thicker
// than its boss plate and entering it only at the rim). Larger differences
// are a rod passing a small part, not a lip; differences under --lip-min of
// the diagonal read flush. A boss standing proud of the rod is a normal
// shoulder and is not reported.
function lipScreen(ctx) {
  const { live, joints, o, diagonal, spacing, sampleRegion, worldPts, worldBox, round, times, period } = ctx;
  const neighbours = new Map();
  for (const joint of joints.values()) {
    if (joint.relation !== 'rigid') continue;
    for (const [a, b] of [[joint.i, joint.j], [joint.j, joint.i]]) {
      if (!neighbours.has(a)) neighbours.set(a, []);
      neighbours.get(a).push(b);
    }
  }
  const rows = [];
  const range = (values) => values.reduce(([lo, hi], x) => [Math.min(lo, x), Math.max(hi, x)], [Infinity, -Infinity]);
  for (const [i, list] of neighbours) {
    const rod = live[i], k = rod.visible.indexOf(true);
    if (k < 0 || rod.connector) continue;
    const pe = principalExtents(worldPts(rod, k));
    if (pe.extents[0] < 3 * pe.extents[1] || !(pe.extents[1] > 0)) continue;
    const axis = pe.axes[0], c = pe.center, width = pe.extents[1];
    let u = pe.axes[1], v = pe.axes[2];
    const coords = (p) => { const d = p.clone().sub(c); return [d.dot(axis), d.dot(u), d.dot(v)]; };
    const coarse = worldPts(rod, k).map(coords);
    const [smin, smax] = range(coarse.map((q) => q[0]));
    const step = Math.max(diagonal / 6000, Math.min(spacing / 2, pe.extents[2] / 12 || spacing / 2));
    for (const sign of [1, -1]) {
      const tEnd = sign > 0 ? smax : -smin;
      const endPoint = c.clone().add(axis.clone().multiplyScalar(sign * tEnd));
      const reach = new THREE.Box3().setFromCenterAndSize(endPoint, new THREE.Vector3(1, 1, 1).multiplyScalar(2 * width));
      const near = list.filter((j) => live[j].visible[k] && !live[j].connector && worldBox(live[j], k).intersectsBox(reach));
      if (!near.length) continue;
      const region = new THREE.Box3();
      worldPts(rod, k).forEach((p, m) => { if (sign * coarse[m][0] >= tEnd - 3 * width) region.expandByPoint(p); });
      region.expandByScalar(1.5 * width);
      const toT = (q) => [sign * q[0], q[1], q[2]];
      const otherWorld = near.flatMap((j) => sampleRegion(live[j], k, region, step).points);
      if (otherWorld.length < 12) continue;
      // Cross-section axes: v along the joined meshes' thinnest direction
      // (a boss plate's normal), u across it, so a round rod is compared
      // face-on and edge-on.
      const thin = principalExtents(otherWorld).axes[2];
      const vt = thin.clone().sub(axis.clone().multiplyScalar(thin.dot(axis)));
      if (vt.lengthSq() > 1e-6) { v = vt.normalize(); u = axis.clone().cross(v).normalize(); }
      const rodPts = sampleRegion(rod, k, region, step).points.map(coords).map(toT);
      const others = otherWorld.map(coords).map(toT);
      const endPts = rodPts.filter((q) => q[0] >= tEnd - 3 * width);
      if (endPts.length < 12 || !others.length) continue;
      const [ru0, ru1] = range(endPts.map((q) => q[1])), [rv0, rv1] = range(endPts.map((q) => q[2]));
      const foot = others.filter((q) => q[1] >= ru0 && q[1] <= ru1 && q[2] >= rv0 && q[2] <= rv1 && q[0] <= tEnd + step);
      if (!foot.length) continue;
      const tEntry = foot.reduce((m, q) => Math.min(m, q[0]), Infinity);
      if (tEntry >= tEnd - 2 * step) continue;
      // The rod must end in the boss: the joined outline runs on past the
      // rod's end (not a bushing or pin carried partway along a bar).
      const beyond = others.filter((q) => q[1] >= ru0 && q[1] <= ru1 && q[2] >= rv0 && q[2] <= rv1).reduce((m, q) => Math.max(m, q[0]), -Infinity);
      if (beyond < tEnd + 0.25 * width) continue;
      const shank = rodPts.filter((q) => q[0] >= tEntry - width && q[0] <= tEntry);
      if (shank.length < 8) continue;
      const [su0, su1] = range(shank.map((q) => q[1])), [sv0, sv1] = range(shank.map((q) => q[2]));
      const inWindow = others.filter((q) => q[0] >= tEntry && q[0] <= tEnd);
      const [bu0, bu1] = range(inWindow.filter((q) => q[2] >= sv0 && q[2] <= sv1).map((q) => q[1]));
      const [bv0, bv1] = range(inWindow.filter((q) => q[1] >= su0 && q[1] <= su1).map((q) => q[2]));
      if (![bu0, bu1, bv0, bv1].every(Number.isFinite)) continue;
      const sides = [['+u', su1 - bu1, su1 - su0], ['-u', bu0 - su0, su1 - su0], ['+v', sv1 - bv1, sv1 - sv0], ['-v', bv0 - sv0, sv1 - sv0]];
      const found = [];
      for (const [side, margin, span] of sides) {
        if (Math.abs(margin) <= o.lipMin * diagonal || !(span > 0)) continue;
        if (margin > 0 && margin < o.lipStep * span) found.push({ side, size: round(margin), relative: round(margin / span) });
      }
      if (!found.length) continue;
      const entryPoint = c.clone().add(axis.clone().multiplyScalar(sign * tEntry));
      rows.push({ rod: rod.role, joined: near.map((j) => live[j].role), lips: found, rodSection: [round(su1 - su0), round(sv1 - sv0)],
        bossSection: [round(bu1 - bu0), round(bv1 - bv0)], entered: round(tEnd - tEntry), phase: round(times[k] / period),
        at: entryPoint.toArray().map(round) });
    }
  }
  const unique = new Map();
  for (const row of rows) {
    const key = `${row.rod}|${row.joined.join()}`;
    if (unique.has(key)) unique.get(key).repeats += 1;
    else unique.set(key, Object.assign(row, { repeats: 1 }));
  }
  // Largest overhang first (in units of the diagonal).
  const size = (row) => Math.max(...row.lips.map((lip) => lip.size));
  return [...unique.values()].map((row) => Object.assign(row, { sizeRelative: round(size(row) / diagonal) }))
    .sort((x, y) => size(y) - size(x));
}

function parseOptions() {
  const num = (name, fallback) => (value(name) === undefined ? fallback : Number(value(name)));
  return { touch: num('--touch', DEFAULTS.touch), figure: num('--figure', DEFAULTS.figure), connect: num('--connect', DEFAULTS.connect), phases: num('--phases', DEFAULTS.phases),
    spacing: num('--spacing', DEFAULTS.spacing), maxPoints: num('--max-points', DEFAULTS.maxPoints),
    sliver: value('--sliver') !== '0', sliverAll: value('--sliver-all') === '1',
    sliverNeck: num('--sliver-neck', SLIVER_DEFAULTS.sliverNeck), sliverArea: num('--sliver-area', SLIVER_DEFAULTS.sliverArea),
    sliverCap: num('--sliver-cap', SLIVER_DEFAULTS.sliverCap), sliverWide: num('--sliver-wide', SLIVER_DEFAULTS.sliverWide),
    sliverEmbed: num('--sliver-embed', SLIVER_DEFAULTS.sliverEmbed), sliverTol: num('--sliver-tol', SLIVER_DEFAULTS.sliverTol),
    lipStep: num('--lip-step', SLIVER_DEFAULTS.lipStep), lipMin: num('--lip-min', SLIVER_DEFAULTS.lipMin) };
}


const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && value('--worker')) {
  const result = await worker(Number(value('--worker')), parseOptions());
  console.log(JSON.stringify(result));
} else if (isMain) {
  for (const arg of args) if (!/^--(ids|out|timeout-ms|jobs|touch|figure|connect|phases|spacing|max-points|max-old-space-size|sliver|sliver-all|sliver-neck|sliver-area|sliver-cap|sliver-wide|sliver-embed|sliver-tol|lip-step|lip-min)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const ids = expandIds(value('--ids') ?? '1-507');
  const timeout = Number(value('--timeout-ms') ?? 900000);
  const jobs = Number(value('--jobs') ?? 1);
  const heap = value('--max-old-space-size') ?? '6144';
  const out = resolve(value('--out') ?? '/dev/shm/507-disconnected-parts.json');
  const extra = args.filter((arg) => /^--(touch|figure|connect|phases|spacing|max-points|sliver|sliver-all|sliver-neck|sliver-area|sliver-cap|sliver-wide|sliver-embed|sliver-tol|lip-step|lip-min)=/.test(arg));
  let report = { generatedAt: new Date().toISOString(), options: parseOptions(),
    scope: 'Rendered-surface gaps between visible meshes at sampled phases; connectors (ropes, belts, springs, deforming meshes, fluids) join but are not flagged; slivers are the only structural attachments whose contact patch is tiny against the parts\' sections; lips are rod ends overhanging their boss; triage for visual review.', movements: [] };
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
      console.log(`${id}: ${result.status ?? `${result.meshes} meshes; detached ${result.detached.length} (floating ${result.detached.filter((row) => row.kind === 'floating').length}), near-miss pairs ${result.nearMissTotal} (short-of-pin ${hinge}), open ends ${result.openEnds.length}, slivers ${result.slivers?.filter((row) => row.flagged).length ?? 0}, lips ${result.lips?.length ?? 0}`} ${result.seconds}s`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, run));
}
