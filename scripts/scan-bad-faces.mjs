// Production-route face-quality scan. Loads each movement the way the browser
// does (model-loader: authored, baked or special factory, then source
// presentation), poses it at t=0 and inspects every rendered mesh for:
//   inward      closed components whose winding (and so normals) face inward
//               on a single-sided material, i.e. the solid renders inside out;
//   shading     triangles whose stored vertex normals oppose their winding
//               (dark or inverted shading even where culling is right);
//   mixed       manifold edges traversed in the same direction by both
//               neighbouring triangles (inconsistent winding in one surface);
//   degenerate  zero-area triangles (reported; harmless unless numerous);
//   zfight      coplanar, coincident, same-facing faces of different meshes
//               (or duplicated faces inside one mesh) that overlap in area
//               and are drawn in different materials (visible flicker);
//               zfightSameLook lists the same overlaps in identical
//               materials (invisible, but duplicated or flush geometry);
//   backToBack  coincident opposite-facing faces where either side is
//               double-sided (renders as z-fighting too);
//   sheet       open, single-plane components (loose faces or caps) and
//               stray flat faces carried beside closed parts in one mesh;
//   sectionCover large flat faces lying in a section/clipping plane that
//               face the viewer and so can cover an intended cutaway.
// Findings are triage evidence at one pose, not a certificate: review each
// flagged case in captures before changing geometry.
//
// Usage: node scripts/scan-bad-faces.mjs [--ids=1-507] [--out=/dev/shm/507-bad-faces.json]
//        [--jobs=1] [--timeout-ms=300000] [--time=0]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const FLUID = /water|fluid|steam|gas(?!ket)|mercury|quicksilver|air(?!-?tight)|flow|stream|jet|spray|plume|smoke|flame|liquid|glow|shadow|envelope|highlight|ghost|glass/i;
const SECTION = /section|cutaway|cut-face|half-revolved/i;

function expandIds(text) {
  return text.split(',').flatMap((part) => {
    const [a, b] = part.split('-').map(Number);
    return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
  });
}

async function worker(id) {
  const THREE = await import('three');
  const { loadMovementModel } = await import('../src/simulation/model-loader.js');
  const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (resource, ...rest) => {
    const url = new URL(resource);
    return url.protocol === 'file:' ? new Response(await readFile(url)) : nativeFetch(resource, ...rest);
  };
  const model = await loadMovementModel(catalog[id - 1]);
  const root = model.root;
  const time = Number(value('--time') ?? 0);
  model.update?.(time, 0);
  root.updateMatrixWorld(true);
  const effectiveVisible = (object) => {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  };
  const materialsOf = (mesh) => [].concat(mesh.material ?? []).filter(Boolean);
  const label = (object) => {
    let named = object;
    while (named && !(named.userData.role || named.name)) named = named.parent;
    const base = named ? String(named.userData.role || named.name) : 'root';
    return named === object ? base : `${base}/${object.geometry.type}`;
  };
  const meshes = [];
  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
    if (!object.geometry?.attributes.position || !effectiveVisible(object)) return;
    const materials = materialsOf(object);
    if (!materials.length || materials.every((m) => m.visible === false || m.colorWrite === false)) return;
    const role = label(object);
    const translucent = materials.some((m) => m.transparent && (m.opacity ?? 1) < 0.95);
    meshes.push({ mesh: object, role, translucent, fluid: FLUID.test(role),
      doubleSided: materials.some((m) => m.side === THREE.DoubleSide),
      backSided: materials.every((m) => m.side === THREE.BackSide),
      clipping: materials.flatMap((m) => m.clippingPlanes ?? []) });
  });
  const box = new THREE.Box3();
  for (const item of meshes) box.expandByObject(item.mesh);
  const diagonal = box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).length();

  // Local-space topology analysis, cached per geometry.
  const topologyCache = new Map();
  const analyse = (geometry) => {
    if (topologyCache.has(geometry)) return topologyCache.get(geometry);
    const p = geometry.attributes.position, n = geometry.attributes.normal, index = geometry.index;
    const count = Math.floor((index?.count ?? p.count) / 3);
    geometry.computeBoundingBox();
    const scale = geometry.boundingBox.getSize(new THREE.Vector3()).length() || 1;
    const quantum = scale * 1e-6;
    const weld = new Map(), vid = new Int32Array(index?.count ?? p.count);
    const corner = (t, j) => (index ? index.getX(3 * t + j) : 3 * t + j);
    for (let i = 0; i < vid.length; i += 1) {
      const k = index ? index.getX(i) : i;
      const key = `${Math.round(p.getX(k) / quantum)},${Math.round(p.getY(k) / quantum)},${Math.round(p.getZ(k) / quantum)}`;
      let v = weld.get(key);
      if (v === undefined) { v = weld.size; weld.set(key, v); }
      vid[i] = v;
    }
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), face = new THREE.Vector3(), vn = new THREE.Vector3(), tmp = new THREE.Vector3();
    const areas = new Float64Array(count), normals = new Float32Array(count * 3), live = new Uint8Array(count);
    let degenerate = 0, shadingArea = 0, totalArea = 0, shadingCount = 0;
    const degenerateArea = (scale * 1e-7) ** 2;
    const edges = new Map();
    const parent = new Int32Array(weld.size).map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let t = 0; t < count; t += 1) {
      const i0 = corner(t, 0), i1 = corner(t, 1), i2 = corner(t, 2);
      a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
      face.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      const area = face.length() / 2;
      const v0 = vid[3 * t], v1 = vid[3 * t + 1], v2 = vid[3 * t + 2];
      if (area <= degenerateArea || v0 === v1 || v1 === v2 || v0 === v2) { degenerate += 1; continue; }
      live[t] = 1; areas[t] = area; totalArea += area;
      face.multiplyScalar(1 / (2 * area));
      normals.set([face.x, face.y, face.z], 3 * t);
      if (n) {
        vn.set(0, 0, 0);
        for (const k of [i0, i1, i2]) vn.add(tmp.fromBufferAttribute(n, k));
        if (vn.lengthSq() > 1e-12 && vn.normalize().dot(face) < -0.3) { shadingArea += area; shadingCount += 1; }
      }
      for (const [u, w] of [[v0, v1], [v1, v2], [v2, v0]]) {
        const key = u < w ? `${u}_${w}` : `${w}_${u}`;
        const entry = edges.get(key);
        if (entry) entry.push(u < w ? 1 : -1); else edges.set(key, [u < w ? 1 : -1]);
      }
      parent[find(v0)] = find(v1); parent[find(v1)] = find(v2);
    }
    let mixedEdges = 0, manifoldEdges = 0;
    const openVertices = new Set();
    for (const [key, dirs] of edges) {
      if (dirs.length === 2) { manifoldEdges += 1; if (dirs[0] === dirs[1]) mixedEdges += 1; }
      if (dirs.length % 2) for (const v of key.split('_')) openVertices.add(Number(v));
    }
    // Components (by welded vertices): closedness, signed volume, planarity.
    const components = new Map();
    for (let t = 0; t < count; t += 1) {
      if (!live[t]) continue;
      const r = find(vid[3 * t]);
      let comp = components.get(r);
      if (!comp) { comp = { triangles: 0, area: 0, volume: 0, open: false, planar: true, normal: null, offset: 0 }; components.set(r, comp); }
      a.fromBufferAttribute(p, corner(t, 0)); b.fromBufferAttribute(p, corner(t, 1)); c.fromBufferAttribute(p, corner(t, 2));
      comp.triangles += 1; comp.area += areas[t];
      comp.volume += a.dot(tmp.crossVectors(b, c)) / 6;
      face.fromArray(normals, 3 * t);
      if (!comp.normal) { comp.normal = face.clone(); comp.offset = face.dot(a); }
      else if (comp.planar && (Math.abs(comp.normal.dot(face)) < 0.9999 || Math.abs(comp.normal.dot(a) - comp.offset) > scale * 1e-5)) comp.planar = false;
      for (let j = 0; j < 3; j += 1) if (openVertices.has(vid[3 * t + j])) comp.open = true;
    }
    const result = { count, degenerate, totalArea, shadingArea, shadingCount, mixedEdges, manifoldEdges,
      components: [...components.values()], areas, normals, live, scale };
    topologyCache.set(geometry, result);
    return result;
  };

  const findings = { inward: [], shading: [], mixed: [], degenerate: [], zfight: [], zfightSameLook: [], backToBack: [], sheet: [], sectionCover: [] };
  const worldNormal = new THREE.Vector3();
  let triangleTotal = 0;
  for (const item of meshes) {
    const topo = analyse(item.mesh.geometry);
    triangleTotal += topo.count;
    const det = item.mesh.matrixWorld.determinant();
    const scaleCube = Math.abs(det);
    if (topo.degenerate > 0) findings.degenerate.push({ role: item.role, type: item.mesh.geometry.type, triangles: topo.count, degenerate: topo.degenerate });
    if (topo.shadingCount > 0 && topo.shadingArea > 1e-3 * topo.totalArea && !item.doubleSided) {
      findings.shading.push({ role: item.role, type: item.mesh.geometry.type, fraction: +(topo.shadingArea / topo.totalArea).toFixed(4), triangles: topo.shadingCount });
    }
    if (topo.mixedEdges > 0) {
      findings.mixed.push({ role: item.role, type: item.mesh.geometry.type, mixedEdges: topo.mixedEdges, manifoldEdges: topo.manifoldEdges });
    }
    const closedParts = topo.components.filter((c) => !c.open);
    for (const comp of topo.components) {
      if (comp.open || comp.planar) continue;
      // Negative signed volume means inward winding; a back-sided material
      // reverses what the viewer sees. Double-sided materials light either way.
      const inward = (comp.volume < 0) !== item.backSided;
      if (inward && !item.doubleSided && Math.abs(comp.volume) * scaleCube > (diagonal * 1e-4) ** 3) {
        findings.inward.push({ role: item.role, type: item.mesh.geometry.type, volume: +(comp.volume * scaleCube).toExponential(3), triangles: comp.triangles, material: item.backSided ? 'back' : 'front' });
      }
    }
    for (const comp of topo.components) {
      if (!comp.planar || !comp.open) continue;
      const area = comp.area * Math.cbrt(scaleCube) ** 2;
      if (area < (diagonal * 0.004) ** 2) continue;
      findings.sheet.push({ role: item.role, type: item.mesh.geometry.type, area: +area.toFixed(5),
        relativeArea: +(area / diagonal ** 2).toExponential(2), triangles: comp.triangles,
        beside: closedParts.length ? 'closed parts in the same mesh' : 'sheet mesh',
        doubleSided: item.doubleSided });
    }
  }

  // World-space coplanar overlap screen (z-fighting and double-sided back to
  // back faces), opaque meshes only.
  // The material drawing triangle t (geometry groups select from arrays).
  const materialOf = (mesh, t) => {
    if (!Array.isArray(mesh.material)) return { material: mesh.material, index: 0 };
    const start = 3 * t;
    const group = mesh.geometry.groups.find((g) => start >= g.start && start < g.start + g.count);
    const index = group?.materialIndex ?? 0;
    return { material: mesh.material[index], index };
  };
  const look = (material) => material ? `${material.color?.getHexString?.() ?? ''}|${material.map ? material.map.uuid : ''}|${material.side}` : '';
  const planeTolerance = diagonal * 2e-5;
  const minOverlap = (diagonal * 0.003) ** 2;
  const buckets = new Map();
  const worldTriangles = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), fn = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  meshes.forEach((item, meshIndex) => {
    if (item.translucent || item.fluid) return;
    const g = item.mesh.geometry, p = g.attributes.position, index = g.index, topo = analyse(g);
    for (let t = 0; t < topo.count; t += 1) {
      if (!topo.live[t]) continue;
      const k = (j) => (index ? index.getX(3 * t + j) : 3 * t + j);
      va.fromBufferAttribute(p, k(0)).applyMatrix4(item.mesh.matrixWorld);
      vb.fromBufferAttribute(p, k(1)).applyMatrix4(item.mesh.matrixWorld);
      vc.fromBufferAttribute(p, k(2)).applyMatrix4(item.mesh.matrixWorld);
      fn.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va));
      const area = fn.length() / 2;
      if (area < minOverlap * 0.05) continue;
      fn.normalize();
      const d = fn.dot(va);
      const record = { meshIndex, triangle: t, a: va.toArray(), b: vb.toArray(), c: vc.toArray(), n: fn.toArray(), d, area, material: materialOf(item.mesh, t) };
      const id = worldTriangles.push(record) - 1;
      // Undirected plane key (so opposite-facing coincident faces meet), with
      // a half-cell shifted second key on the offset to avoid rounding misses.
      const s = fn.x < -1e-9 || (Math.abs(fn.x) <= 1e-9 && (fn.y < -1e-9 || (Math.abs(fn.y) <= 1e-9 && fn.z < 0))) ? -1 : 1;
      const nk = `${Math.round(s * fn.x * 500)},${Math.round(s * fn.y * 500)},${Math.round(s * fn.z * 500)}`;
      const cell = (s * d) / (planeTolerance * 4);
      for (const key of [`${nk}|${Math.round(cell)}`, `${nk}|h${Math.round(cell + 0.5)}`]) {
        const list = buckets.get(key);
        if (list) list.push(id); else buckets.set(key, [id]);
      }
    }
  });
  const project = (tri, axis) => [tri.a, tri.b, tri.c].map((v) => axis === 0 ? [v[1], v[2]] : axis === 1 ? [v[0], v[2]] : [v[0], v[1]]);
  const clipPolygon = (subject, clip) => {
    let output = subject;
    const orient = Math.sign((clip[1][0] - clip[0][0]) * (clip[2][1] - clip[0][1]) - (clip[1][1] - clip[0][1]) * (clip[2][0] - clip[0][0])) || 1;
    for (let i = 0; i < clip.length && output.length; i += 1) {
      const p1 = clip[i], p2 = clip[(i + 1) % clip.length];
      const inside = (q) => orient * ((p2[0] - p1[0]) * (q[1] - p1[1]) - (p2[1] - p1[1]) * (q[0] - p1[0])) >= 0;
      const input = output; output = [];
      for (let j = 0; j < input.length; j += 1) {
        const cur = input[j], prev = input[(j + input.length - 1) % input.length];
        const cin = inside(cur), pin = inside(prev);
        if (cin !== pin) {
          const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
          const denom = (p2[0] - p1[0]) * dy - (p2[1] - p1[1]) * dx;
          const u = denom === 0 ? 0 : ((p2[0] - p1[0]) * (p1[1] - prev[1]) - (p2[1] - p1[1]) * (p1[0] - prev[0])) / denom;
          output.push([prev[0] + u * dx, prev[1] + u * dy]);
        }
        if (cin) output.push(cur);
      }
    }
    let area = 0;
    for (let i = 0; i < output.length; i += 1) { const q = output[i], r = output[(i + 1) % output.length]; area += q[0] * r[1] - q[1] * r[0]; }
    return Math.abs(area) / 2;
  };
  const bbox2 = (pts) => [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
  const overlaps = new Map(), seen = new Set();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    // Project the bucket onto its dominant plane axis and sweep in x, so
    // only triangles whose 2D boxes overlap are clipped against each other.
    const n0 = worldTriangles[list[0]].n;
    const axis = [0, 1, 2].reduce((best, k) => Math.abs(n0[k]) > Math.abs(n0[best]) ? k : best, 0);
    const items = list.map((id) => { const pts = project(worldTriangles[id], axis); return { id, pts, box: bbox2(pts) }; })
      .sort((x, y) => x.box[0] - y.box[0]);
    const active = [];
    for (const itemB of items) {
      for (let k = active.length - 1; k >= 0; k -= 1) if (active[k].box[2] <= itemB.box[0]) active.splice(k, 1);
      for (const itemA of active) {
        const ba = itemA.box, bb = itemB.box;
        if (ba[3] <= bb[1] || bb[3] <= ba[1]) continue;
        const A = worldTriangles[itemA.id], B = worldTriangles[itemB.id];
        const dot = A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2];
        if (Math.abs(dot) < 0.99995) continue;
        if (Math.abs(A.d - Math.sign(dot) * B.d) > planeTolerance) continue;
        if (A.meshIndex === B.meshIndex && dot < 0) continue;
        const key = itemA.id < itemB.id ? itemA.id * 4294967296 + itemB.id : itemB.id * 4294967296 + itemA.id;
        if (seen.has(key)) continue;
        seen.add(key);
        const area = clipPolygon(itemA.pts, itemB.pts);
        if (area <= 1e-12) continue;
        const sameLook = A.material.material === B.material.material || look(A.material.material) === look(B.material.material);
        const kind = dot > 0 ? (sameLook ? 'zfightSameLook' : 'zfight') : 'backToBack';
        const mi = Math.min(A.meshIndex, B.meshIndex), mj = Math.max(A.meshIndex, B.meshIndex);
        const pairKey = `${kind}|${mi}|${mj}`;
        overlaps.set(pairKey, (overlaps.get(pairKey) ?? 0) + area);
      }
      active.push(itemB);
    }
  }
  for (const [pairKey, area] of overlaps) {
    if (area < minOverlap) continue;
    const [kind, i, j] = pairKey.split('|');
    const A = meshes[Number(i)], B = meshes[Number(j)];
    if (kind === 'backToBack' && !A.doubleSided && !B.doubleSided) continue;
    findings[kind].push({ a: A.role, b: B.role, sameMesh: i === j, area: +area.toFixed(6), relativeArea: +(area / diagonal ** 2).toExponential(2) });
  }

  // Section planes: material clipping planes plus the viewer-facing flat
  // faces of meshes named as sections. Other meshes' large flat faces in such
  // a plane, facing the viewer, can close an intended cutaway.
  const cameraDirection = (model.cameraDirection ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
  const planes = [];
  for (const item of meshes) for (const plane of item.clipping) {
    const n = plane.normal.clone().negate();
    planes.push({ normal: n, constant: -plane.constant, source: `clip:${item.role}` });
  }
  for (const item of meshes) {
    if (!SECTION.test(item.role)) continue;
    const topo = analyse(item.mesh.geometry);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(item.mesh.matrixWorld);
    for (let t = 0; t < topo.count; t += 1) {
      if (!topo.live[t]) continue;
      worldNormal.fromArray(topo.normals, 3 * t).applyMatrix3(normalMatrix).normalize();
      if (worldNormal.dot(cameraDirection) < 0.95) continue;
      const g = item.mesh.geometry, k = g.index ? g.index.getX(3 * t) : 3 * t;
      const point = new THREE.Vector3().fromBufferAttribute(g.attributes.position, k).applyMatrix4(item.mesh.matrixWorld);
      const constant = worldNormal.dot(point);
      if (!planes.some((q) => q.normal.dot(worldNormal) > 0.999 && Math.abs(q.constant - constant) < diagonal * 1e-3)) {
        planes.push({ normal: worldNormal.clone(), constant, source: `section:${item.role}` });
      }
    }
  }
  if (planes.length) {
    const coverArea = new Map();
    for (const tri of worldTriangles) {
      const item = meshes[tri.meshIndex];
      // Intended cut faces: section-named meshes, clipped parts, and faces
      // drawn in a mesh's own section material (a later material slot).
      if (SECTION.test(item.role) || item.clipping.length || tri.material.index > 0) continue;
      const n = new THREE.Vector3(...tri.n);
      if (n.dot(cameraDirection) < 0.95) continue;
      for (const plane of planes) {
        if (plane.normal.dot(n) < 0.999) continue;
        const distance = Math.abs(n.dot(new THREE.Vector3(...tri.a)) - plane.constant);
        if (distance > diagonal * 0.005) continue;
        const key = `${tri.meshIndex}|${plane.source}`;
        coverArea.set(key, (coverArea.get(key) ?? 0) + tri.area);
        break;
      }
    }
    for (const [key, area] of coverArea) {
      if (area < 0.005 * diagonal ** 2) continue;
      const [meshIndex, source] = key.split('|');
      findings.sectionCover.push({ role: meshes[Number(meshIndex)].role, plane: source, area: +area.toFixed(5), relativeArea: +(area / diagonal ** 2).toExponential(2) });
    }
  }
  for (const list of Object.values(findings)) list.sort((x, y) => (y.area ?? y.fraction ?? y.mixedEdges ?? y.degenerate ?? 0) - (x.area ?? x.fraction ?? x.mixedEdges ?? x.degenerate ?? 0));
  const flagged = ['inward', 'shading', 'mixed', 'zfight', 'backToBack', 'sectionCover'].filter((k) => findings[k].length);
  console.log(JSON.stringify({ id, time, meshes: meshes.length, triangles: triangleTotal, diagonal: +diagonal.toFixed(4),
    flagged, counts: Object.fromEntries(Object.entries(findings).map(([k, v]) => [k, v.length])),
    findings: Object.fromEntries(Object.entries(findings).map(([k, v]) => [k, v.slice(0, 25)])) }));
}

if (value('--worker')) {
  await worker(Number(value('--worker')));
  process.exit(0);
} else {
  for (const arg of args) if (!/^--(ids|out|timeout-ms|jobs|time)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const ids = expandIds(value('--ids') ?? '1-507');
  const timeout = Number(value('--timeout-ms') ?? 300000);
  const jobs = Number(value('--jobs') ?? 1);
  const out = resolve(value('--out') ?? '/dev/shm/507-bad-faces.json');
  const extra = args.filter((arg) => /^--time=/.test(arg));
  const report = { generatedAt: new Date().toISOString(),
    scope: 'Production route (model-loader, presented) at one pose. Face quality triage: inward closed components, inverted vertex normals, mixed winding, degenerate triangles, coplanar coincident faces (z-fighting), planar sheets and section-plane covers. Review flagged cases visually.',
    movements: [] };
  await mkdir(dirname(out), { recursive: true });
  const queue = [...ids];
  const run = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      let result;
      try {
        const { stdout } = await promisify(execFile)(process.execPath, ['--max-old-space-size=4096', fileURLToPath(import.meta.url), `--worker=${id}`, ...extra], { timeout, maxBuffer: 64 * 1024 * 1024 });
        result = JSON.parse(stdout.trim().split('\n').at(-1));
      } catch (error) {
        result = { id, status: error.killed ? 'timeout' : 'error', error: String(error.stderr || error.message).slice(0, 800) };
      }
      report.movements.push(result);
      report.movements.sort((a, b) => a.id - b.id);
      await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`${id}: ${result.status ?? `${result.meshes} meshes; ${Object.entries(result.counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'clean'}`}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, run));
}
