// Relative-motion intersection screen. Meshes whose relative transform stays
// constant through the cycle form one rigid body; pairs from different bodies
// are checked for rendered-surface penetration in both directions. Only closed
// (watertight) meshes can be targets, because a ray inside test is meaningless
// for open shells. Fluids, deforming geometry and hidden meshes are reported
// separately. This is triage evidence for the sampled phases and spacing, not
// continuous collision certification or source/physics validation.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;
const FLUID = /water|fluid|steam|gas(?!ket)|mercury|air(?!-?tight)|flow|stream|jet|spray|plume|smoke|flame|liquid|ink-trace|trace|glow|shadow|envelope|highlight|ghost/i;

function expandIds(text) {
  return text.split(',').flatMap((part) => {
    const [a, b] = part.split('-').map(Number);
    return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
  });
}

async function worker(id) {
  const THREE = await import('three');
  const { createMovementModel } = await import('../src/simulation/registry.js');
  const { densePoints } = await import('../tests/helpers/dense-points.mjs');
  const { solidSurface } = await import('../tests/helpers/solid-surface.mjs');
  const samples = Number(value('--samples') ?? 65);
  const model = createMovementModel(catalog[id - 1]);
  const root = model.root;
  const displayPeriod = root.userData.animationTiming?.authoredCyclePeriod ?? 10;
  const mechanismPeriod = root.userData.geometry?.mechanismCyclePeriod;
  const period = Number.isFinite(mechanismPeriod) && mechanismPeriod > 0
    ? Math.max(displayPeriod, mechanismPeriod) : displayPeriod;
  const effectiveVisible = (object) => {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  };
  const materialsOf = (mesh) => [].concat(mesh.material ?? []);
  const meshes = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position) return;
    if (object.isInstancedMesh || object.isSkinnedMesh) { meshes.push({ mesh: object, skipped: 'instanced' }); return; }
    let named = object;
    while (named && !(named.userData.role || named.name)) named = named.parent;
    const label = named ? String(named.userData.role || named.name) : 'root';
    const role = named === object ? label : `${label}/${object.geometry.type}`;
    const translucent = materialsOf(object).some((m) => m.transparent && (m.opacity ?? 1) < 0.6);
    const fluid = FLUID.test(role) || translucent;
    meshes.push({ mesh: object, role, fluid, versions: [], geometries: [], matrices: [], visible: [] });
  });
  const live = meshes.filter((item) => !item.skipped);

  // Rigid-body clustering from relative transforms over several phases.
  const clusterTimes = Array.from({ length: 13 }, (_, i) => period * (i + 0.37) / 13);
  for (const time of clusterTimes) {
    model.update(time, period / 13); root.updateMatrixWorld(true);
    for (const item of live) {
      item.matrices.push(item.mesh.matrixWorld.clone());
      item.visible.push(effectiveVisible(item.mesh));
      item.geometries.push(item.mesh.geometry);
      item.versions.push(item.mesh.geometry.attributes.position.version);
    }
  }
  for (const item of live) {
    item.deforming = new Set(item.geometries).size > 1 || new Set(item.versions).size > 1;
    item.everVisible = item.visible.some(Boolean);
  }
  const parent = live.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const box = new THREE.Box3();
  box.makeEmpty();
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

  // A pair whose relative motion keeps a local Y or Z axis line of either mesh
  // fixed in the other's frame is a journal/coaxial pair: overlap there is a
  // missing bore or nested coaxial stock, reported apart from working contact.
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
  const coaxialCache = new Map();
  const coaxial = (a, b) => {
    const key = a.mesh.id < b.mesh.id ? `${a.mesh.id}:${b.mesh.id}` : `${b.mesh.id}:${a.mesh.id}`;
    if (!coaxialCache.has(key)) coaxialCache.set(key, keepsAxis(a, b) || keepsAxis(b, a));
    return coaxialCache.get(key);
  };

  // Closedness: every welded edge must be shared by exactly two triangles.
  const closed = (geometry) => {
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
  };
  const spacing = Number(value('--spacing') ?? Math.max(0.01, diagonal / 400));
  const prepared = new Map();
  const prepare = (item) => {
    const g = item.mesh.geometry, key = `${g.uuid}:${g.attributes.position.version}`;
    if (!prepared.has(key)) {
      const isClosed = closed(g);
      prepared.set(key, { points: densePoints(g, spacing), field: isClosed ? solidSurface(g) : null, closed: isClosed });
    }
    return prepared.get(key);
  };
  const inverse = new THREE.Matrix4(), toTarget = new THREE.Matrix4(), q = new THREE.Vector3();
  const localBox = new THREE.Box3();
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
  const pairs = new Map();
  const worldBoxes = new Map();
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
      const kind = a.fluid || b.fluid ? 'fluid' : a.deforming || b.deforming ? 'deforming'
        : coaxial(a, b) ? 'coaxial' : 'solid';
      const key = `${a.role} x ${b.role}`;
      const previous = pairs.get(key);
      if (!previous || depth > previous.depth) pairs.set(key, { pair: key, kind, depth, time });
    }
  }
  const openMeshes = [...new Set(candidates.filter((item) => !prepare(item).closed).map((item) => item.role))];
  const rows = [...pairs.values()].sort((x, y) => y.depth - x.depth);
  const solid = rows.filter((row) => row.kind === 'solid');
  console.log(JSON.stringify({
    id, period, samples, spacing, diagonal,
    meshes: candidates.length, bodies: new Set(candidates.map((item) => item.body)).size,
    skippedInstanced: meshes.filter((item) => item.skipped).length,
    openMeshes, deforming: [...new Set(candidates.filter((item) => item.deforming).map((item) => item.role))],
    worstSolidDepth: solid[0]?.depth ?? 0, worstSolidRelative: (solid[0]?.depth ?? 0) / diagonal,
    worstCoaxialDepth: rows.find((row) => row.kind === 'coaxial')?.depth ?? 0,
    pairs: rows.slice(0, 40),
  }));
}

if (value('--worker')) {
  await worker(Number(value('--worker')));
} else {
  for (const arg of args) if (!/^--(ids|out|timeout-ms|samples|spacing|jobs)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const ids = expandIds(value('--ids') ?? '1-507');
  const timeout = Number(value('--timeout-ms') ?? 600000);
  const jobs = Number(value('--jobs') ?? 1);
  const out = resolve(value('--out') ?? '/dev/shm/507-body-intersections.json');
  const extra = args.filter((arg) => /^--(samples|spacing)=/.test(arg));
  const report = { generatedAt: new Date().toISOString(), scope: 'Rendered closed-mesh penetration between distinct rigid bodies at sampled phases; open shells are not targets; triage, not certification.', movements: [] };
  await mkdir(dirname(out), { recursive: true });
  const queue = [...ids];
  const run = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      let result;
      try {
        const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), `--worker=${id}`, ...extra], { timeout, maxBuffer: 16 * 1024 * 1024 });
        result = JSON.parse(stdout.trim().split('\n').at(-1));
      } catch (error) {
        result = { id, status: error.killed ? 'timeout' : 'error', error: String(error.stderr || error.message).slice(0, 800) };
      }
      report.movements.push(result);
      report.movements.sort((a, b) => a.id - b.id);
      await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
      const top = result.pairs?.find((row) => row.kind === 'solid');
      console.log(`${id}: ${result.status ?? `${result.bodies} bodies, worst solid ${(result.worstSolidDepth ?? 0).toFixed(4)}${top ? ` (${top.pair} @${top.time.toFixed(2)})` : ''}; coaxial ${(result.worstCoaxialDepth ?? 0).toFixed(4)}; open ${result.openMeshes?.length ?? 0}`}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, run));
}
