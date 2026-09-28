// Smoothness (faceting) screen. Every visible production mesh is welded by
// position and its edges are classified by the dihedral angle between the
// two faces that share them and by whether the renderer shades across them
// smoothly (both endpoints carry the same shading normal on either face):
//   faceted     - hard-shaded edges with a small dihedral angle (default
//                 0.75..25 deg): a curved surface drawn as flat facets, e.g.
//                 an ExtrudeGeometry side wall (three gives every side
//                 triangle its own normal) or a flat-shaded lathe. Reported
//                 with the largest angle, the facet count and the screen area
//                 of the facets at the default framing;
//   lowPoly     - smooth-shaded edges whose chord error w*theta/8 (w: facet
//                 width across the edge) exceeds --chord-px pixels at the
//                 default framing: a round part with too few segments, whose
//                 outline and highlights stay polygonal;
//   smoothed    - smooth-shaded edges sharper than --crease deg: flat faces
//                 meeting at a real corner but shaded as one dome;
//   staircase / jagged - rasterised outlines: (a) in 2D extrusion outlines
//                 (ExtrudeGeometry/ShapeGeometry shapes or userData.outline),
//                 runs of short segments whose turns alternate near +-90 deg,
//                 with the share of axis-aligned segments, and zigzags (sharp
//                 turns reversed at the next vertex, e.g. a swept cutter's
//                 per-pose cusps); (b) in any mesh,
//                 small faces tilted 15..80 deg against two neighbours across
//                 non-parallel edges (spikes and steps, e.g. the steep flank
//                 of a height grid), flagged by count and share of faces.
// Pixel measures assume the model's fitted bounding diagonal spans --view-px
// pixels. One phase is screened (geometry is static per mesh); each geometry
// is analysed once per movement. Triage for visual review, not certification.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as THREE from 'three';
import { expandIds, isFluidRole, loadProductionModel } from './screen-disconnected-parts.mjs';

export const DEFAULTS = { facetMin: 0.75, facetMax: 25, crease: 40, chordPx: 0.6, viewPx: 700, stairRun: 6, zigzags: 20, jaggedFaces: 30, jaggedShare: 0.01 };
const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const DEG = 180 / Math.PI;
// Sculpted figures (hands, people, horses) are organic meshes, not machine parts.
const FIGURE = /(^|-)(hand|fist|cuff|forearm|horse|person|figure|torso|trouser|finger)(-|$)/;
const ROUND_TYPES = /^(Torus|Tube|Sphere|Capsule|Cylinder|Cone|Lathe|Circle|Ring)Geometry$/;

const roleOf = (object) => {
  for (let o = object; o; o = o.parent) if (o.userData?.role || o.name) return o.userData?.role || o.name;
  return '';
};

// Analyse one geometry in its own frame; `scale` converts to world units and
// `pxPerUnit` world units to pixels.
export function analyseGeometry(geometry, { scale = 1, pxPerUnit = 1, flat = false, options = DEFAULTS } = {}) {
  // A smooth-shaded parametric round with steps over the crease angle is a
  // coarse round, not flat faces shaded as a dome.
  const round = ROUND_TYPES.test(geometry.type);
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const index = geometry.index;
  const { start, count } = geometry.drawRange;
  const total = index ? index.count : position.count;
  const end = Math.min(total, Number.isFinite(count) ? start + count : total);
  const corner = (k) => (index ? index.getX(k) : k);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3()).length() || 1;
  // Weld by quantised position.
  const q = size * 1e-6, keyMap = new Map(), weld = new Int32Array(position.count), wp = [];
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const key = `${Math.round(x / q)},${Math.round(y / q)},${Math.round(z / q)}`;
    let w = keyMap.get(key);
    if (w === undefined) { w = wp.length / 3; keyMap.set(key, w); wp.push(x, y, z); }
    weld[i] = w;
  }
  const nv = wp.length / 3, faces = Math.floor((end - start) / 3);
  const fn = new Float64Array(faces * 3), fa = new Float64Array(faces), fv = new Int32Array(faces * 3), fs = new Int32Array(faces * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let f = 0; f < faces; f += 1) {
    for (let j = 0; j < 3; j += 1) { const s = corner(start + 3 * f + j); fs[3 * f + j] = s; fv[3 * f + j] = weld[s]; }
    a.fromBufferAttribute(position, fs[3 * f]); b.fromBufferAttribute(position, fs[3 * f + 1]); c.fromBufferAttribute(position, fs[3 * f + 2]);
    e1.subVectors(b, a).cross(e2.subVectors(c, a));
    const l = e1.length(); fa[f] = l / 2;
    if (l > 0) e1.divideScalar(l);
    fn[3 * f] = e1.x; fn[3 * f + 1] = e1.y; fn[3 * f + 2] = e1.z;
  }
  const shadeAt = (f, j, target) => {
    if (flat || !normal) return target.set(fn[3 * f], fn[3 * f + 1], fn[3 * f + 2]);
    return target.fromBufferAttribute(normal, fs[3 * f + j]).normalize();
  };
  // Edge map on welded vertices.
  const edges = new Map();
  const minArea = (size * 1e-5) ** 2;
  for (let f = 0; f < faces; f += 1) {
    if (fa[f] < minArea) continue;
    for (let j = 0; j < 3; j += 1) {
      const u = fv[3 * f + j], v = fv[3 * f + (j + 1) % 3];
      if (u === v) continue;
      const key = u < v ? u * nv + v : v * nv + u;
      const entry = edges.get(key);
      if (entry === undefined) edges.set(key, [f, j]);
      else if (entry.length === 2) entry.push(f, j);
      else entry.push(-1);
    }
  }
  const out = { faceted: { edges: 0, maxAngle: 0, areaPx: 0 }, lowPoly: { edges: 0, maxChordPx: 0, maxAngle: 0 },
    smoothed: { edges: 0, maxAngle: 0, lengthPx: 0 }, jagged: { faces: 0, largestCluster: 0 } };
  const tilted = new Map();
  const facetedFaces = new Uint8Array(faces);
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3(), nd = new THREE.Vector3();
  const pu = new THREE.Vector3(), pv = new THREE.Vector3();
  for (const [key, entry] of edges) {
    if (entry.length !== 4) continue;
    const [f, j, g, k] = entry;
    const dot = fn[3 * f] * fn[3 * g] + fn[3 * f + 1] * fn[3 * g + 1] + fn[3 * f + 2] * fn[3 * g + 2];
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * DEG;
    if (angle < 0.1 || angle > 150) continue; // coplanar, or a folded/back-to-back sheet
    const u = Math.floor(key / nv), v = key - u * nv;
    pu.fromArray(wp, 3 * u); pv.fromArray(wp, 3 * v);
    const length = pu.distanceTo(pv) * scale;
    // The corners of each face at u and v.
    const cornerOf = (face, w) => (fv[3 * face] === w ? 0 : fv[3 * face + 1] === w ? 1 : 2);
    shadeAt(f, cornerOf(f, u), na); shadeAt(g, cornerOf(g, u), nb);
    shadeAt(f, cornerOf(f, v), nc); shadeAt(g, cornerOf(g, v), nd);
    const smooth = na.dot(nb) > Math.cos(2 / DEG) && nc.dot(nd) > Math.cos(2 / DEG);
    const width = Math.min(2 * fa[f], 2 * fa[g]) * scale * scale / Math.max(length, 1e-12);
    if (angle >= 15 && angle <= 80) {
      const dir = [(pv.x - pu.x), (pv.y - pu.y), (pv.z - pu.z)], l = Math.hypot(...dir) || 1;
      for (const face of [f, g]) { if (!tilted.has(face)) tilted.set(face, []); tilted.get(face).push(dir.map((x) => x / l)); }
    }
    if (smooth) {
      if (angle >= options.crease && !round) {
        out.smoothed.edges += 1; out.smoothed.maxAngle = Math.max(out.smoothed.maxAngle, angle); out.smoothed.lengthPx += length * pxPerUnit;
      } else {
        const chordPx = width * (angle / DEG) / 8 * pxPerUnit;
        if (chordPx > options.chordPx) {
          out.lowPoly.edges += 1; out.lowPoly.maxChordPx = Math.max(out.lowPoly.maxChordPx, chordPx); out.lowPoly.maxAngle = Math.max(out.lowPoly.maxAngle, angle);
        }
      }
    } else if (angle >= options.facetMin && angle < options.facetMax) {
      // Only facets wide enough to read as bands on screen.
      if (width * pxPerUnit < 1.5) continue;
      out.faceted.edges += 1; out.faceted.maxAngle = Math.max(out.faceted.maxAngle, angle);
      facetedFaces[f] = 1; facetedFaces[g] = 1;
    }
  }
  for (let f = 0; f < faces; f += 1) if (facetedFaces[f]) out.faceted.areaPx += fa[f] * scale * scale * pxPerUnit * pxPerUnit;
  // Jagged (raster) surfaces: a small face tilted against two neighbours
  // across non-parallel edges (a spike or step), where a designed surface is
  // smooth (tiny angles), a regular low-poly round (tilted only across
  // parallel edges) or a real corner (near 90 deg). Clusters of such faces
  // are the steps of a height grid or voxel sweep.
  const small = size * 0.04;
  const rough = new Uint8Array(faces);
  for (let f = 0; f < faces; f += 1) {
    const list = tilted.get(f);
    if (!list || list.length < 2) continue;
    let ok = false;
    for (let i = 0; i < list.length && !ok; i += 1) for (let j = i + 1; j < list.length; j += 1)
      if (Math.abs(list[i][0] * list[j][0] + list[i][1] * list[j][1] + list[i][2] * list[j][2]) < 0.85) { ok = true; break; }
    if (!ok) continue;
    let longest = 0;
    for (let j = 0; j < 3; j += 1) { pu.fromArray(wp, 3 * fv[3 * f + j]); pv.fromArray(wp, 3 * fv[3 * f + (j + 1) % 3]); longest = Math.max(longest, pu.distanceTo(pv)); }
    if (longest < small) rough[f] = 1;
  }
  const faceNeighbours = new Map();
  for (const [key, entry] of edges) {
    if (entry.length !== 4) continue;
    const [f, , g] = entry;
    if (!rough[f] || !rough[g]) continue;
    for (const [x, y] of [[f, g], [g, f]]) { if (!faceNeighbours.has(x)) faceNeighbours.set(x, []); faceNeighbours.get(x).push(y); }
  }
  let roughCount = 0;
  const seen = new Uint8Array(faces);
  for (let f = 0; f < faces; f += 1) {
    if (!rough[f]) continue;
    roughCount += 1;
    if (seen[f]) continue;
    let size = 0; const stack = [f]; seen[f] = 1;
    while (stack.length) {
      const x = stack.pop(); size += 1;
      for (const y of faceNeighbours.get(x) ?? []) if (!seen[y]) { seen[y] = 1; stack.push(y); }
    }
    out.jagged.largestCluster = Math.max(out.jagged.largestCluster, size);
  }
  out.jagged.faces = roughCount;
  out.jagged.share = faces ? roughCount / faces : 0;
  return out;
}

// Stair-step runs in closed 2D outlines ([[x, y], ...] loops).
export function staircaseInOutlines(loops, options = DEFAULTS) {
  let longestRun = 0, stairVertices = 0, segments = 0, axisShort = 0, extent = 0, zigzags = 0;
  const all = loops.flat();
  if (!all.length) return { longestRun, stairVertices, axisAlignedShortShare: 0, zigzags };
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  extent = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  for (const raw of loops) {
    const loop = raw.filter((p, i) => { const n = raw[(i + 1) % raw.length]; return Math.hypot(n[0] - p[0], n[1] - p[1]) > extent * 1e-7; });
    const n = loop.length;
    if (n < 4) continue;
    const seg = loop.map((p, i) => { const q = loop[(i + 1) % n]; return [q[0] - p[0], q[1] - p[1]]; });
    const len = seg.map((s) => Math.hypot(...s));
    const short = (i) => len[i] < extent * 0.03;
    for (let i = 0; i < n; i += 1) {
      segments += 1;
      const s = seg[i], axis = Math.min(Math.abs(s[0]), Math.abs(s[1])) / (len[i] || 1);
      if (short(i) && axis < Math.sin(5 / DEG)) axisShort += 1;
    }
    // Turn at vertex i+1 between seg[i] and seg[i+1], signed.
    const turn = (i) => { const s = seg[i], t = seg[(i + 1) % n]; return Math.atan2(s[0] * t[1] - s[1] * t[0], s[0] * t[0] + s[1] * t[1]) * DEG; };
    // Zigzags: sharp turns that reverse at the next vertex, on short segments
    // (per-pose cusps of a swept cutter, raster noise).
    for (let i = 0; i < n; i += 1) {
      const t0 = turn(i), t1 = turn((i + 1) % n);
      if (Math.abs(t0) > 20 && Math.abs(t1) > 20 && Math.sign(t0) !== Math.sign(t1) && len[(i + 1) % n] < extent * 0.005) zigzags += 1;
    }
    let run = 0, lastSign = 0;
    for (let k = 0; k < 2 * n; k += 1) {
      const i = k % n, t = turn(i), sign = Math.sign(t);
      const stair = Math.abs(Math.abs(t) - 90) < 30 && short(i) && short((i + 1) % n) && sign !== lastSign;
      if (stair) { run += 1; lastSign = sign; if (k < n) stairVertices += 1; } else { run = 0; lastSign = 0; }
      longestRun = Math.max(longestRun, Math.min(run, n));
    }
  }
  return { longestRun, stairVertices, axisAlignedShortShare: segments ? axisShort / segments : 0, zigzags };
}

function outlinesOf(geometry) {
  const loops = [];
  const p = geometry.parameters;
  const shapes = p?.shapes ? [].concat(p.shapes) : null;
  if (shapes) {
    for (const shape of shapes) {
      if (!shape?.extractPoints) continue;
      const { shape: outer, holes } = shape.extractPoints(p.options?.curveSegments ?? p.curveSegments ?? 12);
      loops.push(outer.map((v) => [v.x, v.y]), ...holes.map((h) => h.map((v) => [v.x, v.y])));
    }
  } else if (Array.isArray(geometry.userData?.outline) && geometry.userData.outline.length > 3) {
    const o = geometry.userData.outline;
    loops.push(o.map((v) => (Array.isArray(v) ? v : [v.x, v.y])));
  }
  return loops;
}

export function screenModel(model, id, options = DEFAULTS) {
  const root = model.root;
  root.updateMatrixWorld(true);
  const visible = (object) => { for (let o = object; o; o = o.parent) if (!o.visible) return false; return true; };
  const meshes = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position || !visible(object)) return;
    const materials = [].concat(object.material ?? []);
    if (materials.every((m) => m.visible === false || (m.opacity ?? 1) < 0.05 || m.wireframe || m.colorWrite === false)) return;
    const role = roleOf(object);
    if (isFluidRole(role)) return;
    meshes.push(object);
  });
  const bounds = root.userData.cameraFitBounds?.isBox3 ? root.userData.cameraFitBounds.clone() : new THREE.Box3();
  if (bounds.isEmpty()) for (const m of meshes) bounds.expandByObject(m);
  const diagonal = bounds.getSize(new THREE.Vector3()).length() || 1;
  const pxPerUnit = options.viewPx / diagonal;
  const done = new Map(), rows = [];
  let triangles = 0;
  for (const mesh of meshes) {
    const s = new THREE.Vector3(); mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    const scale = Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
    const flat = [].concat(mesh.material).some((m) => m?.flatShading);
    const key = `${mesh.geometry.uuid}|${scale.toFixed(4)}|${flat}`;
    let result = done.get(key);
    if (!result) {
      const g = mesh.geometry;
      result = analyseGeometry(g, { scale, pxPerUnit, flat, options });
      result.stair = staircaseInOutlines(outlinesOf(g), options);
      // A bevelled extrusion's chamfer corners are small faces tilted against
      // two neighbours by design.
      if (g.parameters?.options?.bevelEnabled) result.jagged = { faces: 0, largestCluster: 0, share: 0 };
      result.type = g.type; result.triangles = Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
      done.set(key, result);
      triangles += result.triangles;
    } else continue;
    rows.push({ role: roleOf(mesh), type: result.type, triangles: result.triangles, instances: mesh.isInstancedMesh ? mesh.count : 1,
      faceted: result.faceted, lowPoly: result.lowPoly, smoothed: result.smoothed, jagged: result.jagged, stair: result.stair });
  }
  const r = (x) => Math.round(x * 100) / 100;
  // Severity: faceting by angle and visible band area, low-poly by chord
  // error, smoothed creases by length, stairs by run length and cluster size.
  for (const row of rows) {
    row.flags = [];
    if (row.faceted.edges && row.faceted.maxAngle >= 2 && row.faceted.areaPx > 400) row.flags.push('faceted');
    // A laid rope's strand valleys are meant to be shaded round.
    // Its helical strands also read as tilted facets to the jagged test.
    if (row.type === 'LaidRopeGeometry') { row.smoothed = { edges: 0, maxAngle: 0, lengthPx: 0 }; row.jagged = { faces: 0, largestCluster: 0, share: 0 }; }
    if (row.lowPoly.edges && row.lowPoly.maxChordPx > 1) row.flags.push('low-poly');
    if (row.smoothed.edges && row.smoothed.lengthPx > 40) row.flags.push('smoothed-crease');
    // Square teeth, knurls and castellations also alternate +-90 deg turns but
    // follow the part's own radial directions; raster steps follow one grid.
    if (row.stair.longestRun >= options.stairRun && row.stair.axisAlignedShortShare >= 0.25) row.flags.push('staircase-outline');
    if (row.stair.zigzags >= options.zigzags) row.flags.push('zigzag-outline');
    if (row.jagged.faces >= options.jaggedFaces && row.jagged.share >= options.jaggedShare) row.flags.push('jagged-surface');
    row.score = r(Math.min(row.faceted.maxAngle, 25) * Math.sqrt(row.faceted.areaPx) / 100 * (row.faceted.maxAngle >= 2 ? 1 : 0.2)
      + 4 * Math.min(row.lowPoly.maxChordPx, 10)
      + Math.min(row.smoothed.lengthPx, 2000) / 100
      + (row.flags.includes('staircase-outline') ? 3 * Math.max(0, row.stair.longestRun - 3) : 0)
      + (row.flags.includes('zigzag-outline') ? Math.min(40, row.stair.zigzags / 10) : 0)
      + (row.jagged.faces >= options.jaggedFaces && row.jagged.share >= options.jaggedShare ? Math.min(40, row.jagged.faces / 5) : 0));
    row.jagged.share = r(row.jagged.share * 100) / 100;
    if (FIGURE.test(row.role)) row.figure = true;
    row.faceted = { edges: row.faceted.edges, maxAngle: r(row.faceted.maxAngle), areaPx: Math.round(row.faceted.areaPx) };
    row.lowPoly = { edges: row.lowPoly.edges, maxChordPx: r(row.lowPoly.maxChordPx), maxAngle: r(row.lowPoly.maxAngle) };
    row.smoothed = { edges: row.smoothed.edges, maxAngle: r(row.smoothed.maxAngle), lengthPx: Math.round(row.smoothed.lengthPx) };
    row.stair.axisAlignedShortShare = r(row.stair.axisAlignedShortShare);
  }
  rows.sort((x, y) => y.score - x.score);
  const flagged = rows.filter((row) => row.flags.length && !row.figure);
  const figures = rows.filter((row) => row.flags.length && row.figure);
  return { id, meshes: meshes.length, geometries: rows.length, triangles, diagonal: r(diagonal),
    score: r(flagged.reduce((s, row) => s + row.score, 0)), flaggedMeshes: flagged.length,
    flags: [...new Set(flagged.flatMap((row) => row.flags))], worst: flagged.slice(0, 8),
    figureScore: r(figures.reduce((s, row) => s + row.score, 0)), figures: figures.slice(0, 4) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && value('--worker')) {
  const id = Number(value('--worker'));
  console.log(JSON.stringify(screenModel(await loadProductionModel(id), id)));
} else if (isMain) {
  for (const arg of args) if (!/^--(ids|out|timeout-ms|jobs|max-old-space-size)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const ids = expandIds(value('--ids') ?? '1-507');
  const timeout = Number(value('--timeout-ms') ?? 600000);
  const jobs = Number(value('--jobs') ?? 1);
  const heap = value('--max-old-space-size') ?? '8192';
  const out = resolve(value('--out') ?? '/dev/shm/507-faceting.json');
  const report = { generatedAt: new Date().toISOString(), options: DEFAULTS,
    scope: 'Welded-edge dihedral and shading-normal analysis of every visible mesh at phase 0, plus stair-step runs in 2D extrusion outlines and jagged crease clusters; pixel measures assume the fitted diagonal spans viewPx; triage for visual review.', movements: [] };
  try {
    const previous = JSON.parse(await readFile(out, 'utf8'));
    if (previous?.movements) report.movements = previous.movements.filter((m) => !ids.includes(m.id));
  } catch { /* fresh report */ }
  await mkdir(dirname(out), { recursive: true });
  const queue = [...ids], started0 = Date.now();
  const run = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      let result;
      const started = Date.now();
      try {
        const { stdout } = await promisify(execFile)(process.execPath, [`--max-old-space-size=${heap}`, fileURLToPath(import.meta.url), `--worker=${id}`], { timeout, maxBuffer: 256 * 1024 * 1024 });
        result = JSON.parse(stdout.trim().split('\n').at(-1));
      } catch (error) {
        result = { id, status: error.killed ? 'timeout' : 'error', error: String(error.stderr || error.message).slice(0, 800) };
      }
      result.seconds = Math.round((Date.now() - started) / 1000);
      report.movements = report.movements.filter((m) => m.id !== id).concat(result).sort((a, b) => a.id - b.id);
      await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`${id}: ${result.status ?? `score ${result.score}, ${result.flaggedMeshes}/${result.geometries} flagged [${result.flags.join(' ')}]`} ${result.seconds}s`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, run));
  report.seconds = Math.round((Date.now() - started0) / 1000);
  report.ranking = report.movements.filter((m) => m.score > 0).sort((a, b) => b.score - a.score)
    .map((m) => ({ id: m.id, score: m.score, flags: m.flags, top: m.worst?.[0] ? `${m.worst[0].role} [${m.worst[0].flags.join(' ')}]` : '' }));
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
}
