// Coincident-face (z-fighting) screen. For each sampled phase, every
// triangle of every visible mesh is placed in world space and bucketed by its
// plane (canonical normal and offset). Triangle pairs from neighbouring
// buckets whose planes coincide (normals within --angle degrees, either
// facing, and the overlap within --dist x diagonal of both planes) and whose
// projected areas overlap are coincident. Pairs are taken between different
// meshes and within one mesh (duplicate faces). Each coincident patch is then
// asked whether it can flicker:
//   - each face renders from the half-spaces its material side allows
//     (FrontSide: along its normal; BackSide: against it; DoubleSide: both;
//     a mirrored world matrix swaps front and back);
//   - the pair can only fight on a side both faces render from;
//   - that side is hidden when the point just off the patch on that side lies
//     inside a closed, opaque, visible mesh (two blocks glued face to face:
//     each face points into the other's solid, so neither side shows).
// A patch is visible when some shared side is not hidden. Materials with
// depthTest off or a polygon offset are resolved by the renderer and skipped.
// Opaque pairs of identical appearance (same material look and shading
// normals toward the viewer) are counted as `sameLook`: their fight cannot be
// seen. Transparent faces that both skip the depth write cannot fight either;
// where they coincide the shared face is drawn twice as an internal sheet
// inside what should read as one body of water or steam, and those pairs are
// reported apart as `seams`. Areas are summed per mesh pair; each pair is
// reported at the phase where its visible area is largest. Triage for visual
// review, not a certification.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as THREE from 'three';
import { solidSurface } from '../tests/helpers/solid-surface.mjs';
import { expandIds, isFluidRole, loadProductionModel, mergeInstances, snapshotGeometry } from './screen-disconnected-parts.mjs';

export const DEFAULTS = { dist: 1e-4, angle: 0.5, phases: 4, minArea: 1e-9, offset: 3 };

const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

// Rendering properties of a material that decide whether a face fights.
export function materialInfo(material) {
  const m = material ?? {};
  const invisible = m.visible === false || (m.opacity ?? 1) < 0.05 || m.colorWrite === false || m.isShadowMaterial || m.wireframe;
  const transparent = Boolean((m.transparent && (m.opacity ?? 1) < 0.99) || (m.transmission ?? 0) > 0 || m.userData?.seeThrough);
  const side = m.side === THREE.DoubleSide ? 2 : m.side === THREE.BackSide ? 1 : 0;
  const resolved = m.depthTest === false || Boolean(m.polygonOffset && (m.polygonOffsetFactor || m.polygonOffsetUnits));
  const color = m.color ? m.color.getHexString() : '';
  const rgb = m.color ? [m.color.r, m.color.g, m.color.b] : [1, 1, 1];
  const look = [color, m.emissive?.getHexString() ?? '', (m.opacity ?? 1).toFixed(2), m.map?.uuid ?? '', m.vertexColors ? 'vc' : '',
    (m.roughness ?? '').toString(), (m.metalness ?? '').toString(), m.flatShading ? 'flat' : ''].join('|');
  // Transparent materials here usually skip the depth write; two faces that
  // both skip it blend in draw order and cannot fight.
  const depthWrite = m.depthWrite !== false;
  return { invisible: Boolean(invisible), transparent, side, resolved, depthWrite, look, uuid: m.uuid, rgb,
    opacity: m.opacity ?? 1, roughness: m.roughness ?? 0.5, metalness: m.metalness ?? 0, textured: Boolean(m.map || m.vertexColors) };
}

// How different two coincident faces look (0: identical): the largest colour
// channel difference, half the roughness and metalness differences, the
// shading-normal difference, and the opacity of a transparent face (its tint
// comes and goes). Textured or vertex-coloured faces count as 0.5.
export function lookContrast(a, b, shadeDot = 1) {
  let c = Math.max(...a.rgb.map((x, i) => Math.abs(x - b.rgb[i])));
  c += 0.5 * Math.abs(a.roughness - b.roughness) + 0.5 * Math.abs(a.metalness - b.metalness) + Math.max(0, 1 - shadeDot);
  if (a.transparent !== b.transparent) c = Math.max(c, a.transparent ? a.opacity : b.opacity);
  if (a.textured || b.textured) c = Math.max(c, 0.5);
  return Math.min(1, c);
}

// Sides (bit 1: along the face normal, bit 2: against it) a face renders from.
export function sideMask(side, mirrored) {
  const mask = side === 2 ? 3 : side === 1 ? 2 : 1;
  return mirrored && mask !== 3 ? 3 - mask : mask;
}

// Area of the convex polygon `poly` ([[x, y], ...]) clipped to the triangle
// `tri` (Sutherland-Hodgman), with the clipped polygon.
export function clipConvex(poly, tri) {
  let t = tri;
  const orient = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0]);
  if (orient < 0) t = [t[0], t[2], t[1]];
  let out = poly;
  for (let e = 0; e < 3 && out.length; e += 1) {
    const a = t[e], b = t[(e + 1) % 3];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const side = (p) => ex * (p[1] - a[1]) - ey * (p[0] - a[0]);
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i += 1) {
      const p = input[i], q = input[(i + 1) % input.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const f = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
      }
    }
  }
  let area = 0;
  for (let i = 0; i < out.length; i += 1) {
    const p = out[i], q = out[(i + 1) % out.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  return { area: Math.abs(area) / 2, polygon: out };
}

// Closed = every edge (vertices merged by position) is shared by two faces.
export function isClosed(geometry) {
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
  if (!edges.size) return false;
  for (const n of edges.values()) if (n === 1) return false;
  return true;
}

// Generic direction used to fold opposite normals into one bucket.
const FOLD = [0.2718, 0.5772, 0.7701];

// Screens any model exposing { root, update(time, delta) }.
export function screenModel(model, id, options = DEFAULTS) {
  const o = { ...DEFAULTS, ...options };
  const root = model.root;
  const displayPeriod = root.userData.animationTiming?.authoredCyclePeriod ?? 10;
  const mechanismPeriod = root.userData.geometry?.mechanismCyclePeriod;
  const period = Number.isFinite(mechanismPeriod) && mechanismPeriod > 0 ? Math.max(displayPeriod, mechanismPeriod) : displayPeriod;
  const effectiveVisible = (object) => {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  };
  const items = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position || object.isSkinnedMesh) return;
    let named = object;
    while (named && !(named.userData.role || named.name)) named = named.parent;
    const label = named ? String(named.userData.role || named.name) : 'root';
    const role = named === object ? label : `${label}/${object.geometry.type}`;
    const materials = [].concat(object.material ?? []).map(materialInfo);
    const invisibleMaterial = materials.every((m) => m.invisible);
    items.push({ mesh: object, index: items.length, role, materials, invisibleMaterial, fluid: isFluidRole(role),
      instancedMesh: Boolean(object.isInstancedMesh), matrices: [], visible: [], snapshots: [], keys: [] });
  });

  const phases = o.phases;
  const times = Array.from({ length: phases }, (_, i) => period * (i + 0.21) / phases);
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  for (const [k, time] of times.entries()) {
    model.update(time, period / phases); root.updateMatrixWorld(true);
    for (const item of items) {
      item.matrices.push(item.mesh.matrixWorld.clone());
      item.visible.push(effectiveVisible(item.mesh) && !item.invisibleMaterial);
      const g = item.mesh.geometry;
      const key = item.instancedMesh ? `${g.uuid}:${g.attributes.position.version}:${item.mesh.instanceMatrix.version}:${item.mesh.count}` : `${g.uuid}:${g.attributes.position.version}`;
      const last = item.snapshots.at(-1);
      const changed = !last || key !== item.keys.at(-1);
      item.keys.push(key);
      item.snapshots.push(changed ? (item.instancedMesh ? mergeInstances(item.mesh) : snapshotGeometry(g)) : last);
      if (changed && item.instancedMesh === false && g.attributes.normal) item.snapshots.at(-1).setAttribute('normal', g.attributes.normal.clone());
      if (changed && g.groups?.length && !item.instancedMesh) for (const group of g.groups) item.snapshots.at(-1).addGroup(group.start, group.count, group.materialIndex);
      if (k === 0 && item.visible[0]) {
        const s = item.snapshots[0];
        s.computeBoundingBox();
        box.union(tmp.copy(s.boundingBox).applyMatrix4(item.mesh.matrixWorld));
      }
    }
  }
  const diagonal = box.isEmpty() ? 10 : box.getSize(new THREE.Vector3()).length();
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const distTol = o.dist * diagonal, cosTol = Math.cos(o.angle * Math.PI / 180);
  const minArea = o.minArea * diagonal * diagonal, offset = o.offset * distTol;
  const live = items.filter((item) => item.visible.some(Boolean));

  // Occluders: closed, opaque meshes. Surfaces are cached per snapshot.
  const closedCache = new Map(), surfaceCache = new Map();
  const closedOf = (g) => {
    if (!closedCache.has(g.uuid)) closedCache.set(g.uuid, isClosed(g));
    return closedCache.get(g.uuid);
  };
  const surfaceOf = (g) => {
    if (!surfaceCache.has(g.uuid)) surfaceCache.set(g.uuid, solidSurface(g));
    return surfaceCache.get(g.uuid);
  };
  const materialFor = (item, g, t) => {
    if (item.materials.length <= 1) return item.materials[0] ?? materialInfo(null);
    const start = t * 3;
    for (const group of g.groups ?? []) if (start >= group.start && start < group.start + group.count) return item.materials[group.materialIndex] ?? item.materials[0];
    return item.materials[0];
  };

  const pairs = new Map();
  let triangles = 0, candidates = 0, coincident = 0;
  const excluded = { hiddenArea: 0, resolvedArea: 0, sameLookArea: 0, noSharedSideArea: 0 };
  for (let k = 0; k < phases; k += 1) {
    const meshes = live.filter((item) => item.visible[k]);
    // World triangles.
    const tris = [];
    const occluders = [];
    const P = [];
    for (const item of meshes) {
      const g = item.snapshots[k], m = item.matrices[k];
      const mirrored = m.determinant() < 0;
      const pos = g.attributes.position, idx = g.index, nrm = item.instancedMesh ? null : g.attributes.normal;
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      const count = (idx?.count ?? pos.count) / 3;
      const opaque = item.materials.every((mat) => mat.invisible || !mat.transparent);
      if (opaque && closedOf(g)) {
        g.computeBoundingBox();
        occluders.push({ item, g, box: g.boundingBox.clone().applyMatrix4(m), inverse: m.clone().invert() });
      }
      const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], n = new THREE.Vector3();
      const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), sn = new THREE.Vector3();
      for (let t = 0; t < count; t += 1) {
        const mat = materialFor(item, g, t);
        if (mat.invisible) continue;
        const vi = [0, 1, 2].map((j) => (idx ? idx.getX(t * 3 + j) : t * 3 + j));
        for (let j = 0; j < 3; j += 1) v[j].fromBufferAttribute(pos, vi[j]).applyMatrix4(m);
        e1.subVectors(v[1], v[0]); e2.subVectors(v[2], v[0]);
        n.crossVectors(e1, e2);
        const len = n.length();
        const area = len / 2;
        if (!(area > minArea)) continue;
        n.multiplyScalar(1 / len);
        let shade = null;
        if (nrm) {
          sn.set(0, 0, 0);
          for (const j of vi) sn.add(new THREE.Vector3().fromBufferAttribute(nrm, j));
          shade = sn.applyMatrix3(nm).normalize().toArray();
        }
        const base = P.length;
        for (let j = 0; j < 3; j += 1) P.push(v[j].x, v[j].y, v[j].z);
        const flip = n.x * FOLD[0] + n.y * FOLD[1] + n.z * FOLD[2] < 0 ? -1 : 1;
        const cx = (v[0].x + v[1].x + v[2].x) / 3 - center.x, cy = (v[0].y + v[1].y + v[2].y) / 3 - center.y, cz = (v[0].z + v[1].z + v[2].z) / 3 - center.z;
        const fx = flip * n.x, fy = flip * n.y, fz = flip * n.z;
        tris.push({ item, t, base, n: [n.x, n.y, n.z], area, mat, mask: sideMask(mat.side, mirrored), shade,
          key: [Math.round(fx / 0.01), Math.round(fy / 0.01), Math.round(fz / 0.01), Math.round((fx * cx + fy * cy + fz * cz) / (0.02 * diagonal))],
          min: [Math.min(v[0].x, v[1].x, v[2].x) - distTol, Math.min(v[0].y, v[1].y, v[2].y) - distTol, Math.min(v[0].z, v[1].z, v[2].z) - distTol],
          max: [Math.max(v[0].x, v[1].x, v[2].x) + distTol, Math.max(v[0].y, v[1].y, v[2].y) + distTol, Math.max(v[0].z, v[1].z, v[2].z) + distTol] });
      }
    }
    triangles = Math.max(triangles, tris.length);
    const buckets = new Map();
    const keyText = (key) => key.join(',');
    for (const tri of tris) {
      const text = keyText(tri.key);
      if (!buckets.has(text)) buckets.set(text, []);
      buckets.get(text).push(tri);
    }
    for (const list of buckets.values()) list.sort((a, b) => a.min[0] - b.min[0]);

    // Occlusion: is the point inside some closed opaque mesh?
    const occludedCache = new Map();
    const local = new THREE.Vector3();
    const occluded = (point) => {
      const cell = 0.25 * distTol;
      const ck = `${Math.round(point.x / cell)},${Math.round(point.y / cell)},${Math.round(point.z / cell)}`;
      if (occludedCache.has(ck)) return occludedCache.get(ck);
      let hit = null;
      for (const occ of occluders) {
        if (!occ.box.containsPoint(point)) continue;
        local.copy(point).applyMatrix4(occ.inverse);
        if (surfaceOf(occ.g).inside(local)) { hit = occ.item.role; break; }
      }
      occludedCache.set(ck, hit);
      return hit;
    };

    const u = new THREE.Vector3(), w = new THREE.Vector3(), a0 = new THREE.Vector3(), q = new THREE.Vector3();
    const test = (A, B) => {
      candidates += 1;
      if (A.item === B.item && A.t === B.t) return;
      const dot = A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2];
      if (Math.abs(dot) < cosTol) return;
      // Quick plane distance of B's centroid.
      const pa = A.base, pb = B.base;
      const bx = (P[pb] + P[pb + 3] + P[pb + 6]) / 3, by = (P[pb + 1] + P[pb + 4] + P[pb + 7]) / 3, bz = (P[pb + 2] + P[pb + 5] + P[pb + 8]) / 3;
      const ax = P[pa], ay = P[pa + 1], az = P[pa + 2];
      // B's centroid may be far from the overlap, so allow the angular slack.
      const reach = Math.hypot(P[pb] - bx, P[pb + 1] - by, P[pb + 2] - bz) + Math.hypot(P[pb + 3] - bx, P[pb + 4] - by, P[pb + 5] - bz) + Math.hypot(P[pb + 6] - bx, P[pb + 7] - by, P[pb + 8] - bz);
      const dist = Math.abs(A.n[0] * (bx - ax) + A.n[1] * (by - ay) + A.n[2] * (bz - az));
      if (dist > distTol + reach * Math.sqrt(Math.max(0, 1 - dot * dot)) + 1e-12) return;
      // Same mesh, same facing, sharing one or two corners: fan or strip
      // neighbours, not duplicates (which share all three).
      if (A.item === B.item && dot > 0) {
        let shared = 0;
        for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
          if (Math.abs(P[pa + 3 * i] - P[pb + 3 * j]) + Math.abs(P[pa + 3 * i + 1] - P[pb + 3 * j + 1]) + Math.abs(P[pa + 3 * i + 2] - P[pb + 3 * j + 2]) < 1e-9 * diagonal) shared += 1;
        }
        if (shared === 1 || shared === 2) return;
      }
      // Project both onto A's plane and clip.
      a0.set(ax, ay, az);
      u.set(P[pa + 3] - ax, P[pa + 4] - ay, P[pa + 5] - az).normalize();
      const nA = new THREE.Vector3(...A.n);
      w.crossVectors(nA, u);
      const to2 = (base, i) => { q.set(P[base + 3 * i] - ax, P[base + 3 * i + 1] - ay, P[base + 3 * i + 2] - az); return [q.dot(u), q.dot(w)]; };
      const triA = [to2(pa, 0), to2(pa, 1), to2(pa, 2)];
      const triB = [to2(pb, 0), to2(pb, 1), to2(pb, 2)];
      const { area, polygon } = clipConvex(triB, triA);
      if (!(area > minArea)) return;
      // The overlap must lie within tolerance of both planes.
      const nB = B.n, b0 = [P[pb], P[pb + 1], P[pb + 2]];
      const centroid = new THREE.Vector3();
      for (const [x, y] of polygon) {
        const p = a0.clone().addScaledVector(u, x).addScaledVector(w, y);
        if (Math.abs(nB[0] * (p.x - b0[0]) + nB[1] * (p.y - b0[1]) + nB[2] * (p.z - b0[2])) > distTol) return;
        centroid.add(p);
      }
      centroid.multiplyScalar(1 / polygon.length);
      coincident += 1;
      const facing = dot > 0 ? 'same' : 'opposite';
      // Sides in A's normal frame: bit 1 = +nA, bit 2 = -nA.
      const maskB = dot > 0 ? B.mask : (B.mask === 3 ? 3 : 3 - B.mask);
      const shared = A.mask & maskB;
      const [first, second] = A.item.index <= B.item.index ? [A, B] : [B, A];
      // Transparent faces that both skip the depth write cannot fight, but
      // their shared face is drawn twice: an internal sheet (a seam) inside
      // what should read as one body of water or steam.
      const seam = !A.mat.depthWrite && !B.mat.depthWrite;
      const pairKey = `${first.item.index}:${second.item.index}:${seam ? 'seam' : 'fight'}`;
      if (!pairs.has(pairKey)) pairs.set(pairKey, { a: first.item, b: second.item, seam, phases: new Map() });
      const perPhase = pairs.get(pairKey).phases;
      if (!perPhase.has(k)) perPhase.set(k, { area: 0, sameLookArea: 0, hiddenArea: 0, resolvedArea: 0, noSharedSideArea: 0, tris: 0, facing: { same: 0, opposite: 0 }, sides: new Set(),
        transparent: [false, false], sum: new THREE.Vector3(), min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity), hiddenBy: new Set() });
      const row = perPhase.get(k);
      if (A.mat.resolved || B.mat.resolved) { row.resolvedArea += area; excluded.resolvedArea += area; return; }
      if (!shared) { row.noSharedSideArea += area; excluded.noSharedSideArea += area; return; }
      // Each face is lit with its normal turned toward the viewing side, so
      // opposite-facing shading normals are compared reversed.
      // Identical appearance: the fight cannot be seen.
      const shadeDot = A.shade && B.shade ? Math.sign(dot) * (A.shade[0] * B.shade[0] + A.shade[1] * B.shade[1] + A.shade[2] * B.shade[2]) : 1;
      const sameLook = !A.mat.transparent && !B.mat.transparent && (A.mat.uuid === B.mat.uuid || A.mat.look === B.mat.look) && shadeDot > 0.995;
      if (sameLook && !seam) { row.sameLookArea += area; excluded.sameLookArea += area; return; }
      let visibleSide = 0;
      for (const bit of [1, 2]) {
        if (!(shared & bit)) continue;
        const probe = centroid.clone().addScaledVector(nA, bit === 1 ? offset : -offset);
        const by = occluded(probe);
        if (!by) { visibleSide |= bit; } else row.hiddenBy.add(by);
      }
      if (!visibleSide) { row.hiddenArea += area; excluded.hiddenArea += area; return; }
      row.area += area; row.tris += 1; row.facing[facing] += 1;
      row.contrast = Math.max(row.contrast ?? 0, lookContrast(A.mat, B.mat, shadeDot));
      row.sides.add(visibleSide === 3 ? 'both' : visibleSide === 1 ? 'front' : 'back');
      if (first === A) { row.transparent[0] ||= A.mat.transparent; row.transparent[1] ||= B.mat.transparent; } else { row.transparent[0] ||= B.mat.transparent; row.transparent[1] ||= A.mat.transparent; }
      row.sum.addScaledVector(centroid, area);
      if (!(row.peakArea >= area)) { row.peakArea = area; row.peak = centroid.clone(); row.peakNormal = nA.clone().multiplyScalar(visibleSide & 1 ? 1 : -1); }
      row.min.min(centroid); row.max.max(centroid);
    };

    // Sweep-and-prune on x within and between neighbouring buckets.
    const overlapYZ = (A, B) => A.min[1] <= B.max[1] && B.min[1] <= A.max[1] && A.min[2] <= B.max[2] && B.min[2] <= A.max[2];
    const within = (list) => {
      for (let i = 0; i < list.length; i += 1) {
        const A = list[i];
        for (let j = i + 1; j < list.length && list[j].min[0] <= A.max[0]; j += 1) if (overlapYZ(A, list[j])) test(A, list[j]);
      }
    };
    const between = (L1, L2) => {
      let i = 0, j = 0, active1 = [], active2 = [];
      while (i < L1.length || j < L2.length) {
        const takeFirst = j >= L2.length || (i < L1.length && L1[i].min[0] <= L2[j].min[0]);
        const X = takeFirst ? L1[i++] : L2[j++];
        const others = (takeFirst ? active2 : active1).filter((Y) => Y.max[0] >= X.min[0]);
        for (const Y of others) if (overlapYZ(X, Y)) test(takeFirst ? X : Y, takeFirst ? Y : X);
        if (takeFirst) { active2 = others; active1.push(X); } else { active1 = others; active2.push(X); }
      }
    };
    const offsets = [];
    for (let a = -1; a <= 1; a += 1) for (let b = -1; b <= 1; b += 1) for (let c = -1; c <= 1; c += 1) for (let d = -1; d <= 1; d += 1) offsets.push([a, b, c, d]);
    for (const [text, list] of buckets) {
      const key = list[0].key;
      within(list);
      for (const off of offsets) {
        if (!off.some(Boolean)) continue;
        const other = keyText(key.map((x, i) => x + off[i]));
        if (!(other > text)) continue;
        const L2 = buckets.get(other);
        if (L2) between(list, L2);
      }
    }
  }

  const round = (x, digits = 4) => (Number.isFinite(x) ? Number(x.toPrecision(digits)) : null);
  const d2 = diagonal * diagonal;
  const rows = [];
  for (const { a, b, seam, phases: perPhase } of pairs.values()) {
    let best = null, bestK = -1, sums = { sameLookArea: 0, hiddenArea: 0, resolvedArea: 0, noSharedSideArea: 0 }, phasesVisible = 0;
    for (const [k, row] of perPhase) {
      for (const key of Object.keys(sums)) sums[key] = Math.max(sums[key], row[key]);
      if (row.area > minArea) phasesVisible += 1;
      if (!best || row.area > best.area) { best = row; bestK = k; }
    }
    const base = { parts: a === b ? [a.role] : [a.role, b.role], kind: seam ? 'seam' : 'fight', sameMesh: a === b, meshIndex: a === b ? [a.index] : [a.index, b.index] };
    if (!(best.area > minArea)) {
      rows.push({ ...base, visible: false, area: 0, areaRelative: 0, sameLookRelative: round(sums.sameLookArea / d2), hiddenRelative: round(sums.hiddenArea / d2),
        resolvedRelative: round(sums.resolvedArea / d2), noSharedSideRelative: round(sums.noSharedSideArea / d2), hiddenBy: [...new Set([...perPhase.values()].flatMap((r) => [...r.hiddenBy]))].slice(0, 4) });
      continue;
    }
    rows.push({ ...base, visible: true, area: round(best.area), areaRelative: round(best.area / d2), triPairs: best.tris, facing: best.facing,
      sides: [...best.sides], transparent: best.transparent, fluid: [a.fluid, b.fluid],
      phase: round(times[bestK] / period), phasesVisible,
      at: best.sum.clone().multiplyScalar(1 / best.area).toArray().map((x) => round(x, 5)),
      extent: best.max.clone().sub(best.min).toArray().map((x) => round(x)),
      contrast: round(best.contrast, 3), peak: best.peak.toArray().map((x) => round(x, 5)), peakArea: round(best.peakArea), peakNormal: best.peakNormal.toArray().map((x) => round(x, 3)),
      sameLookRelative: round(sums.sameLookArea / d2), hiddenRelative: round(sums.hiddenArea / d2) });
  }
  const flagged = rows.filter((r) => r.visible && r.kind === 'fight').sort((x, y) => y.area - x.area);
  const seams = rows.filter((r) => r.visible && r.kind === 'seam').sort((x, y) => y.area - x.area);
  return { id, period, phases, diagonal: round(diagonal), distTol: round(distTol), meshes: live.length, triangles, candidates, coincidentTriPairs: coincident,
    flaggedPairs: flagged.length, totalAreaRelative: round(flagged.reduce((s, r) => s + r.area, 0) / d2),
    excludedRelative: Object.fromEntries(Object.entries(excluded).map(([key, x]) => [key, round(x / d2)])),
    pairs: flagged.slice(0, 80), seamPairs: seams.length, seamAreaRelative: round(seams.reduce((s, r) => s + r.area, 0) / d2), seams: seams.slice(0, 40),
    excludedPairs: rows.filter((r) => !r.visible).sort((x, y) => (y.hiddenRelative + y.sameLookRelative) - (x.hiddenRelative + x.sameLookRelative)).slice(0, 20) };
}

function parseOptions() {
  const num = (name, fallback) => (value(name) === undefined ? fallback : Number(value(name)));
  return { dist: num('--dist', DEFAULTS.dist), angle: num('--angle', DEFAULTS.angle), phases: num('--phases', DEFAULTS.phases),
    minArea: num('--min-area', DEFAULTS.minArea), offset: num('--offset', DEFAULTS.offset) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && value('--worker')) {
  const id = Number(value('--worker'));
  const result = screenModel(await loadProductionModel(id), id, parseOptions());
  console.log(JSON.stringify(result));
} else if (isMain) {
  for (const arg of args) if (!/^--(ids|out|timeout-ms|jobs|dist|angle|phases|min-area|offset|max-old-space-size)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const ids = expandIds(value('--ids') ?? '1-507');
  const timeout = Number(value('--timeout-ms') ?? 900000);
  const jobs = Number(value('--jobs') ?? 1);
  const heap = value('--max-old-space-size') ?? '8192';
  const out = resolve(value('--out') ?? '/dev/shm/507-coincident-faces.json');
  const extra = args.filter((arg) => /^--(dist|angle|phases|min-area|offset)=/.test(arg));
  const report = { generatedAt: new Date().toISOString(), options: parseOptions(),
    scope: 'Coplanar overlapping triangles (between visible meshes and within one mesh) at sampled phases, kept when both faces render from a side that is not inside a closed opaque mesh and they differ in appearance; areas are relative to the squared bounding diagonal; triage for visual review.', movements: [] };
  try {
    const previous = JSON.parse(await readFile(out, 'utf8'));
    if (previous?.movements) report.movements = previous.movements.filter((m) => !ids.includes(m.id));
  } catch { /* fresh report */ }
  await mkdir(dirname(out), { recursive: true });
  const queue = [...ids];
  const started0 = Date.now();
  const run = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      let result;
      const started = Date.now();
      try {
        const { stdout } = await promisify(execFile)(process.execPath, [`--max-old-space-size=${heap}`, fileURLToPath(import.meta.url), `--worker=${id}`, ...extra], { timeout, maxBuffer: 256 * 1024 * 1024 });
        result = JSON.parse(stdout.trim().split('\n').at(-1));
      } catch (error) {
        result = { id, status: error.killed ? 'timeout' : 'error', error: String(error.stderr || error.message).slice(0, 800) };
      }
      result.seconds = Math.round((Date.now() - started) / 1000);
      report.movements = report.movements.filter((m) => m.id !== id).concat(result).sort((a, b) => a.id - b.id);
      await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`${id}: ${result.status ?? `${result.meshes} meshes, ${result.triangles} tris; ${result.flaggedPairs} flagged pairs, area ${result.totalAreaRelative}; ${result.seamPairs} seams`} ${result.seconds}s`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, run));
  report.seconds = Math.round((Date.now() - started0) / 1000);
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
}
