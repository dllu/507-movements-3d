// Edge-mount screen. Handles, grips, knobs, crank pins, hinge pins and pivots
// should stand centred in a boss or eye with a margin round them, or on their
// part's centreline, not on the very edge of the plate they are mounted on.
//
// For every production model (loaded as the browser does), at sampled phases:
//   1. candidates are visible cylinder-like meshes (Cylinder, Lathe or Capsule
//      geometry, or any mesh whose section about one local axis is round)
//      whose role reads as a handle, grip, knob, crank pin, hinge pin, pivot,
//      stud, rivet or similar (PINLIKE of screen-disconnected-parts, less the
//      mounting words: boss, eye, hub, collar, bearing, and less shafts);
//   2. a mount is any other visible solid mesh whose triangles meet the pin's
//      length (overlap its axial span, within a small tolerance) and whose
//      silhouette, projected on the plane normal to the pin's axis, reaches
//      the pin's circle and is larger than the pin's own section there;
//   3. the mount's outline near the pin is the union of its projected
//      triangles inside a window of 3 pin radii round the axis. The margin d
//      is the distance from the pin's axis to that outline's outer boundary
//      (holes such as the pin's own bore are ignored; d < 0 when the axis
//      lies outside the part).
// A pair is flagged when d < (1 + --margin) r, i.e. the pin's circle reaches
// within --margin (default 0.1) of its radius of the outline, or crosses it.
// r is the pin's radius where it meets the mount (the section inside the
// mount's slab), so a turned handle is measured at its foot.
// A flagged pair is cleared when another mesh of the same rigid body (same
// parent group) encloses the pin with margin.
// Pins whose axis lies outside a part and whose circle only grazes it
// (overlap under 0.1 r) are working contacts and are skipped. Triage
// evidence only: pins in gabs or open slots, and pins meant to ride an edge,
// can still be flagged and need a visual check.
//
// Usage: node scripts/screen-edge-mounts.mjs [--ids=1-507] [--jobs=4]
//   [--phases=2] [--margin=0.1] [--out=/dev/shm/p92/edge.json]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { PINLIKE, CONNECTOR, isFluidRole, expandIds, loadProductionModel, mergeInstances, snapshotGeometry } from './screen-disconnected-parts.mjs';

const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);

// Handles and pins proper. PINLIKE also names the parts pins are mounted in
// (boss, eye, hub, collar, bearing) and shafts turning in bearings; those are
// excluded here.
export const MOUNTED = new RegExp(`${PINLIKE.source}|handle|grip|knob|pintle|wrist`, 'i');
export const NOT_MOUNTED = /boss|eye|washer|bushing|ferrule|(^|-)caps?(-|$)|ball|seat|operator|hand-(?!crank|lever|handle|grip)|forearm|finger|fist|hub|collar|bearing|shaft|axle|arbor|spindle|journal|bore|hole|socket|sleeve|drum|barrel|roller|pulley|wheel|gear|pinion|tooth|teeth|rope|cord|chain|belt|spring|figure|body|torso|arm-with|lever-with|frame|column|post|pillar|standard|cylinder-bore|piston/i;
const WINDOW = 3; // outline window, in pin radii
const ROUND_BINS = 24;

const round = (x, k = 4) => Number(x.toFixed(k));

// Local axis (0 x, 1 y, 2 z) about which the geometry is round, with its
// radius profile, or null.
function roundAxis(geometry, type = geometry.type) {
  const p = geometry.attributes.position;
  geometry.computeBoundingBox();
  // A Cylinder/Lathe/Capsule is round about local y unless a rotation was
  // baked into its vertices (e.g. cylinderAlongZ's rotateX); then its type
  // no longer names the axis and the section test below decides.
  if (/^(Cylinder|Lathe|Capsule)Geometry$/.test(type)) {
    const s = geometry.boundingBox.getSize(new THREE.Vector3());
    if (Math.abs(s.x - s.z) <= 0.04 * Math.max(s.x, s.z)) return 1;
  }
  if (!p || p.count < 12) return null;
  const size = geometry.boundingBox.getSize(new THREE.Vector3()).toArray();
  const centre = geometry.boundingBox.getCenter(new THREE.Vector3()).toArray();
  for (let k = 0; k < 3; k += 1) {
    const [i, j] = [0, 1, 2].filter((n) => n !== k);
    if (!(size[i] > 0) || Math.abs(size[i] - size[j]) > 0.04 * Math.max(size[i], size[j])) continue;
    const bins = new Array(ROUND_BINS).fill(0);
    for (let n = 0; n < p.count; n += 1) {
      const a = p.getComponent(n, i) - centre[i], b = p.getComponent(n, j) - centre[j];
      const bin = Math.floor(((Math.atan2(b, a) + Math.PI) / (2 * Math.PI)) * ROUND_BINS) % ROUND_BINS;
      bins[bin] = Math.max(bins[bin], Math.hypot(a, b));
    }
    // Coarse facetings leave some bins empty; judge the filled ones.
    const filled = bins.filter((b) => b > 0);
    const lo = Math.min(...filled), hi = Math.max(...filled);
    if (filled.length >= ROUND_BINS / 2 && hi / lo < 1.15) return k;
  }
  return null;
}

// World triangles of a snapshot geometry as a flat Float64Array.
function worldTriangles(geometry, matrix) {
  const p = geometry.attributes.position, index = geometry.index;
  const count = index ? index.count : p.count;
  const out = new Float64Array(count * 3);
  const v = new THREE.Vector3();
  for (let n = 0; n < count; n += 1) {
    v.fromBufferAttribute(p, index ? index.getX(n) : n).applyMatrix4(matrix);
    out[n * 3] = v.x; out[n * 3 + 1] = v.y; out[n * 3 + 2] = v.z;
  }
  return out;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function insideRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Screens one loaded model.
export function screenModel(model, id, options) {
  const root = model.root;
  const period = root.userData.animationTiming?.authoredCyclePeriod ?? 10;
  const visibleNow = (object) => {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    const materials = [].concat(object.material ?? []);
    return !materials.every((m) => m.visible === false || (m.opacity ?? 1) < 0.05 || m.colorWrite === false);
  };
  const items = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position || object.isSkinnedMesh) return;
    let named = object;
    while (named && !(named.userData.role || named.name)) named = named.parent;
    const label = named ? String(named.userData.role || named.name) : 'root';
    const role = named === object ? label : `${label}/${object.geometry.type}`;
    const materials = [].concat(object.material ?? []);
    const translucent = materials.some((m) => m.transparent && (m.opacity ?? 1) < 0.8);
    const seeThrough = Boolean(object.userData.seeThrough || materials.some((m) => m.userData?.seeThrough));
    const fluid = isFluidRole(role) || (translucent && !seeThrough);
    items.push({ mesh: object, role, fluid, rope: CONNECTOR.test(role) });
  });
  const times = Array.from({ length: options.phases }, (_, i) => period * (i + 0.21) / options.phases);
  const best = new Map();
  let candidates = 0, errors = 0;
  for (const time of times) {
    model.update(time, period / options.phases); root.updateMatrixWorld(true);
    const live = [];
    for (const item of items) {
      if (item.fluid || !visibleNow(item.mesh)) continue;
      const geometry = item.mesh.isInstancedMesh ? mergeInstances(item.mesh) : snapshotGeometry(item.mesh.geometry);
      const tris = worldTriangles(geometry, item.mesh.matrixWorld);
      const box = new THREE.Box3();
      for (let n = 0; n < tris.length; n += 3) box.expandByPoint(new THREE.Vector3(tris[n], tris[n + 1], tris[n + 2]));
      live.push({ ...item, geometry, tris, box });
    }
    for (const pin of live) {
      if (pin.rope || pin.mesh.isInstancedMesh || !MOUNTED.test(pin.role) || NOT_MOUNTED.test(pin.role)) continue;
      const k = roundAxis(pin.geometry, pin.mesh.geometry.type);
      if (k === null) continue;
      candidates += 1;
      if (process.env.EDGE_DEBUG) console.error('candidate', pin.role, pin.geometry.type);
      // Pin frame: axis a through the local section centre.
      pin.geometry.computeBoundingBox();
      const localCentre = pin.geometry.boundingBox.getCenter(new THREE.Vector3());
      const axisLocal = new THREE.Vector3().setComponent(k, 1);
      const m = pin.mesh.matrixWorld;
      const origin = localCentre.clone().applyMatrix4(m);
      const a = axisLocal.clone().transformDirection(m);
      const u = new THREE.Vector3(1, 0, 0);
      if (Math.abs(u.dot(a)) > 0.9) u.set(0, 1, 0);
      u.sub(a.clone().multiplyScalar(u.dot(a))).normalize();
      const v = new THREE.Vector3().crossVectors(a, u);
      const toFrame = (x, y, z) => {
        const dx = x - origin.x, dy = y - origin.y, dz = z - origin.z;
        return [dx * u.x + dy * u.y + dz * u.z, dx * v.x + dy * v.y + dz * v.z, dx * a.x + dy * a.y + dz * a.z];
      };
      // Pin vertices in its frame: axial span and radius profile.
      const pv = [];
      for (let n = 0; n < pin.tris.length; n += 3) pv.push(toFrame(pin.tris[n], pin.tris[n + 1], pin.tris[n + 2]));
      let z0 = Infinity, z1 = -Infinity, rMax = 0;
      for (const [x, y, z] of pv) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); rMax = Math.max(rMax, Math.hypot(x, y)); }
      if (!(rMax > 0) || z1 - z0 < 0.2 * rMax) continue; // a washer or disc, not a pin
      const W = WINDOW * rMax, tol = 0.15 * rMax;
      const reach = new THREE.Box3().copy(pin.box).expandByScalar(W);
      for (const mount of live) {
        if (mount === pin || mount.rope || !mount.box.intersectsBox(reach)) continue;
        // Meshes of one named part (a lever's own turned boss) are one piece.
        if (mount.role.split('/')[0] === pin.role.split('/')[0]) continue;
        if (/figure|operator|forearm|(^|-)(ground|floor|earth|foundation)(-|$)/i.test(mount.role)) continue;
        // Mount triangles in the pin frame that meet the pin's span and window.
        const polys = [];
        let mz0 = Infinity, mz1 = -Infinity;
        for (let n = 0; n < mount.tris.length; n += 9) {
          const t = [0, 3, 6].map((o) => toFrame(mount.tris[n + o], mount.tris[n + o + 1], mount.tris[n + o + 2]));
          const tz0 = Math.min(t[0][2], t[1][2], t[2][2]), tz1 = Math.max(t[0][2], t[1][2], t[2][2]);
          if (tz1 < z0 - tol || tz0 > z1 + tol) continue;
          const xs = t.map((p) => p[0]), ys = t.map((p) => p[1]);
          if (Math.min(...xs) > W || Math.max(...xs) < -W || Math.min(...ys) > W || Math.max(...ys) < -W) continue;
          const area = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]);
          if (Math.abs(area) < 1e-10 * rMax * rMax) continue;
          const ring = t.map((p) => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7]);
          polys.push([area > 0 ? [...ring, ring[0]] : [ring[0], ring[2], ring[1], ring[0]]]);
          mz0 = Math.min(mz0, tz0); mz1 = Math.max(mz1, tz1);
        }
        if (process.env.EDGE_DEBUG) console.error('  near', mount.role, polys.length);
        if (!polys.length) continue;
        let shape;
        try {
          const disk = [Array.from({ length: 65 }, (_, i) => [W * Math.cos((i % 64) * Math.PI / 32), W * Math.sin((i % 64) * Math.PI / 32)])];
          shape = polygonClipping.intersection(polygonClipping.union(...polys), disk);
        } catch { errors += 1; continue; }
        if (!shape.length) continue;
        let area = 0;
        for (const polygon of shape) for (const [h, ring] of polygon.entries()) {
          let s = 0;
          for (let i = 0; i + 1 < ring.length; i += 1) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          area += (h === 0 ? 1 : -1) * Math.abs(s) / 2;
        }
        // Pin radius where it meets the mount: its section inside the mount's slab.
        let rFoot = 0;
        for (const [x, y, z] of pv) if (z >= mz0 - tol && z <= mz1 + tol) rFoot = Math.max(rFoot, Math.hypot(x, y));
        const r = rFoot > 0 ? rFoot : rMax;
        if (area < 1.2 * Math.PI * r * r) continue; // smaller than the pin: mounted on it, not it on this
        // Margin to the outer boundary (holes ignored).
        let dIn = Infinity, dOut = Infinity, inside = false;
        for (const polygon of shape) {
          const outer = polygon[0];
          let dist = Infinity;
          for (let i = 0; i + 1 < outer.length; i += 1) dist = Math.min(dist, segmentDistance(0, 0, ...outer[i], ...outer[i + 1]));
          if (insideRing(outer, 0, 0)) { inside = true; dIn = Math.min(dIn, dist); } else dOut = Math.min(dOut, dist);
        }
        // Axis outside the part: only a mount if the pin's circle clearly
        // overlaps it; a circle merely tangent to an outline from outside is
        // a working contact (a pin riding a slot wall, a stop), not a mount.
        if (!inside && dOut >= 0.9 * r) continue;
        const d = inside ? dIn : -dOut;
        const ratio = d / r;
        const key = `${pin.role}|${mount.role}`;
        const row = { pin: pin.role, mount: mount.role, body: mount.mesh.parent?.uuid, radius: round(r), margin: round(d), ratio: round(ratio, 3),
          flagged: ratio < 1 + options.margin, phase: round(time / period, 3), at: origin.toArray().map((c) => round(c)),
          axis: a.toArray().map((c) => round(c, 3)), pinSpan: round(z1 - z0), mountSpan: [round(mz0), round(mz1)] };
        const prev = best.get(key);
        if (!prev || row.ratio < prev.ratio) best.set(key, Object.assign(row, { phases: (prev?.phases ?? 0) + 1 }));
        else prev.phases += 1;
      }
    }
  }
  // A flagged mount is not an edge mount when a mesh of the same rigid body
  // (same parent group) already encloses the pin with margin, e.g. a rod
  // ending at the pin behind the rod's own coaxial boss or crosshead block.
  const rows = [...best.values()];
  for (const row of rows) {
    if (!row.flagged) continue;
    const cover = rows.find((other) => other !== row && other.pin === row.pin && !other.flagged && other.body === row.body);
    if (cover) Object.assign(row, { flagged: false, enclosedBy: cover.mount });
  }
  for (const row of rows) delete row.body;
  const pairs = rows.sort((x, y) => x.ratio - y.ratio);
  return { id, candidates, pairs: pairs.length, errors, hits: pairs.filter((p) => p.flagged), clear: pairs.filter((p) => !p.flagged).length };
}

function parseOptions() {
  const num = (name, fallback) => (value(name) === undefined ? fallback : Number(value(name)));
  return { phases: num('--phases', 2), margin: num('--margin', 0.1) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && value('--worker')) {
  const id = Number(value('--worker'));
  const result = screenModel(await loadProductionModel(id), id, parseOptions());
  console.log(JSON.stringify(result));
  process.exit(0);
} else if (isMain) {
  for (const arg of args) if (!/^--(ids|out|jobs|phases|margin|timeout-ms)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const ids = expandIds(value('--ids') ?? '1-507');
  const jobs = Number(value('--jobs') ?? 4);
  const timeout = Number(value('--timeout-ms') ?? 600000);
  const out = resolve(value('--out') ?? '/dev/shm/p92/edge.json');
  const extra = args.filter((arg) => /^--(phases|margin)=/.test(arg));
  const report = { generatedAt: new Date().toISOString(), options: parseOptions(),
    scope: 'Cylinder-like handle/pin meshes against the parts they stand on or pass through: distance from the pin axis to the part\'s outer outline in the plane normal to the axis, in pin radii; flagged below 1 + margin. Triage for visual review.', movements: [] };
  try {
    const previous = JSON.parse(await readFile(out, 'utf8'));
    if (previous?.movements) report.movements = previous.movements.filter((m) => !ids.includes(m.id));
  } catch { /* fresh report */ }
  await mkdir(dirname(out), { recursive: true });
  const queue = [...ids];
  const run = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      let result;
      try {
        const { stdout } = await promisify(execFile)(process.execPath, ['--max-old-space-size=6144', fileURLToPath(import.meta.url), `--worker=${id}`, ...extra], { timeout, maxBuffer: 64 * 1024 * 1024 });
        result = JSON.parse(stdout.trim().split('\n').at(-1));
      } catch (error) {
        result = { id, status: error.killed ? 'timeout' : 'error', error: String(error.stderr || error.message).slice(0, 600) };
      }
      report.movements = report.movements.filter((m) => m.id !== id).concat(result).sort((a, b) => a.id - b.id);
      console.log(`${id}: ${result.status ?? `${result.candidates} pin samples, ${result.pairs} pairs, ${result.hits.length} flagged`}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, run));
  report.ranked = report.movements.flatMap((m) => (m.hits ?? []).map((h) => ({ id: m.id, ...h }))).sort((x, y) => x.ratio - y.ratio);
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.ranked.length} flagged pairs in ${new Set(report.ranked.map((h) => h.id)).size} movements -> ${out}`);
}
