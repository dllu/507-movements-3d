// Finite verge/crown-wheel audit for Movements 234, 298, 299 and 302. Every
// visible mesh carried by the verge is compared with every visible mesh on the
// crown-wheel rotor in both directions, using densely sampled rendered
// surfaces rather than the model's own tip/pallet contact equations.
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { densePoints } from '../tests/helpers/dense-points.mjs';
import { solidSurface } from '../tests/helpers/solid-surface.mjs';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const match = /^--([^=]+)=(.+)$/.exec(arg);
  if (!match) throw new Error('Use --ids=234,298 --samples=513 [--out=/dev/shm/verge.json]');
  return match.slice(1);
}));
const ids = (options.ids ?? '234,298,299,302').split(',').map(Number);
const samples = Number(options.samples ?? 513);
const spacing = Number(options.spacing ?? 0.03);
const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

function visibleMeshes(group) {
  const result = [];
  group.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position) return;
    for (let node = object; node; node = node.parent) if (!node.visible) return;
    result.push(object);
  });
  return result;
}

function prepare(mesh) {
  return { mesh, points: densePoints(mesh.geometry, spacing), field: solidSurface(mesh.geometry),
    role: mesh.userData.role ?? mesh.name ?? mesh.type };
}

const inverse = new THREE.Matrix4(), relative = new THREE.Matrix4(), q = new THREE.Vector3();
function penetration(source, target) {
  // Most negative signed distance of the source surface inside the target solid.
  inverse.copy(target.mesh.matrixWorld).invert();
  relative.multiplyMatrices(inverse, source.mesh.matrixWorld);
  let worst = Infinity;
  const box = target.field.box;
  for (const point of source.points) {
    q.copy(point).applyMatrix4(relative);
    if (!box.containsPoint(q)) continue;
    if (!target.field.inside(q)) continue;
    worst = Math.min(worst, -target.field.distance(q));
  }
  return worst;
}

function worldBox(item) {
  item.mesh.geometry.computeBoundingBox();
  return item.mesh.geometry.boundingBox.clone().applyMatrix4(item.mesh.matrixWorld);
}

const report = [];
for (const id of ids) {
  const model = createMovementModel(catalog.movements[id - 1]);
  const { blocks } = model.root.userData;
  const verge = visibleMeshes(blocks.verge).map(prepare);
  const crown = visibleMeshes(blocks.crownWheel).map(prepare);
  const period = model.root.userData.geometry?.mechanismCyclePeriod
    ?? model.root.userData.animationTiming?.authoredCyclePeriod ?? 4;
  const pairs = new Map();
  for (let i = 0; i < samples; i += 1) {
    const time = period * i / (samples - 1);
    model.update(time); model.root.updateMatrixWorld(true);
    const boxes = new Map([...verge, ...crown].map((item) => [item, worldBox(item).expandByScalar(0.01)]));
    for (const a of verge) for (const b of crown) {
      if (!boxes.get(a).intersectsBox(boxes.get(b))) continue;
      const depth = Math.min(penetration(a, b), penetration(b, a));
      if (!Number.isFinite(depth)) continue;
      const key = `${a.role} x ${b.role}`;
      const previous = pairs.get(key);
      if (!previous || depth < previous.depth) pairs.set(key, { depth, time });
    }
  }
  const rows = [...pairs].map(([pair, value]) => ({ pair, ...value })).sort((x, y) => x.depth - y.depth);
  report.push({ id, samples, spacing, penetratingPairs: rows });
  console.log(id, rows.length ? rows.slice(0, 8).map((r) => `${r.pair}: ${r.depth.toFixed(5)} @${r.time.toFixed(3)}`).join('\n    ') : 'no sampled penetration');
}
if (options.out) await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`);
