import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { wormAndWheel } from '../src/simulation/authored-gears.js';
import { surfaceTriangles, surfacePoints, solidSurface } from '../tests/helpers/solid-surface.mjs';

const candidate = JSON.parse(await readFile(process.env.PROBE_PROFILE ?? 'artifacts/review/031-corrected-worm-profile.json', 'utf8'));
const model = wormAndWheel({ ...candidate.parameters, profile: candidate.profile, wheelPhase: candidate.wheelPhase ?? Math.PI / 2,
  shaftOffsetX: candidate.shaftOffsetX ?? 0, shaftRadius: candidate.shaftRadius ?? 0.075, wormAngularSteps: 640 });
const { blocks } = model.root.userData;
const parts = [];
for (const [name, group] of Object.entries(blocks)) group.traverse(mesh => {
  // The wheel's white plane is a painted index, without a solid volume.
  if (!mesh.isMesh || mesh.geometry.type === 'PlaneGeometry') return;
  parts.push({ name: name + '-' + parts.length, family: name.startsWith('worm') ? 'worm' : 'wheel', mesh,
    points: surfacePoints(mesh.geometry), solid: solidSurface(mesh.geometry) });
});
const topology = parts.map(({ name, mesh }) => {
  const positions = mesh.geometry.attributes.position, normals = mesh.geometry.attributes.normal, index = mesh.geometry.index;
  const edges = new Map(), key = v => v.toArray().map(x => Math.round(x * 1e9)).join(',');
  let volume = 0, wrongNormals = 0, degenerate = 0;
  const faces = surfaceTriangles(mesh.geometry);
  for (let i = 0; i < faces.length; i++) {
    const { a, b, c } = faces[i], cross = b.clone().sub(a).cross(c.clone().sub(a));
    if (cross.lengthSq() < 1e-22) { degenerate++; continue; }
    volume += a.dot(b.clone().cross(c)) / 6;
    const mean = new THREE.Vector3();
    for (let j = 0; j < 3; j++) mean.add(new THREE.Vector3().fromBufferAttribute(normals, index ? index.getX(i * 3 + j) : i * 3 + j));
    if (cross.dot(mean) <= 0) wrongNormals++;
    const keys = [a, b, c].map(key);
    for (let j = 0; j < 3; j++) {
      const from = keys[j], to = keys[(j + 1) % 3];
      if (from === to) continue;
      const k = from < to ? `${from}/${to}` : `${to}/${from}`, edge = edges.get(k) ?? { count: 0, direction: 0 };
      edge.count++; edge.direction += from < to ? 1 : -1; edges.set(k, edge);
    }
  }
  return { name, triangles: faces.length, volume, wrongNormals, degenerate,
    badEdges: [...edges.values()].filter(e => e.count !== 2 || e.direction !== 0).length };
});
const pairs = [];
for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
  const a = parts[i], b = parts[j];
  if (a.family === b.family) continue;
  if ([a.mesh, b.mesh].includes(blocks.worm.userData.thread) && [a.mesh, b.mesh].includes(blocks.wheel.userData.toothMesh)) continue;
  pairs.push({ a, b, rows: [] });
}
for (let pose = 0; pose < 65; pose++) {
  const time = 2 * Math.PI / 2.2 * (pose + 0.317) / 65;
  model.update(time); model.root.updateMatrixWorld(true);
  for (const pair of pairs) {
    const { a, b } = pair;
    const boxA = a.solid.box.clone().applyMatrix4(a.mesh.matrixWorld), boxB = b.solid.box.clone().applyMatrix4(b.mesh.matrixWorld);
    let checks = 0, inside = 0, maximumDepth = 0;
    if (boxA.intersectsBox(boxB)) for (const [from, to] of [[a, b], [b, a]]) {
      const matrix = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
      for (const point of from.points) {
        const q = point.clone().applyMatrix4(matrix); checks++;
        if (!to.solid.inside(q)) continue;
        const depth = to.solid.distance(q); if (depth <= 1e-6) continue;
        inside++; maximumDepth = Math.max(maximumDepth, depth);
      }
    }
    pair.rows.push({ time, checks, inside, maximumDepth, separatedWorldBoxes: !boxA.intersectsBox(boxB) });
  }
  console.log({ pose, inside: pairs.reduce((sum, pair) => sum + pair.rows[pose].inside, 0) });
}
const rows = pairs.map(({ a, b, rows }) => ({ pair: [a.name, b.name], rows }));
const report = { movement: 31, status: 'isolated-corrected-candidate',
  method: 'Six physical solids in two rigid families. The white wheel plane is paint. Hub/shaft/thread joins within one rotating family are integral or fixed overlaps. All eight independent hardware pairs excluding the separately audited worm/wheel pair use conservative transformed-box separation or bidirectional actual Float32 triangle vertices, edge midpoints and centers at 65 worm poses. Topology checks all six solids with oriented edge pairing at 1e-9, positive volume and outward stored normals.',
  topology, pairs: rows, summary: { poses: 65, pairs: rows.length,
    checks: rows.reduce((sum, pair) => sum + pair.rows.reduce((s, r) => s + r.checks, 0), 0),
    inside: rows.reduce((sum, pair) => sum + pair.rows.reduce((s, r) => s + r.inside, 0), 0),
    topologyIssues: topology.filter(r => r.volume <= 0 || r.wrongNormals || r.badEdges).length } };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/031-corrected-worm-hardware.json', JSON.stringify(report, null, 2) + '\n');
console.log(report.summary); if (report.summary.inside || report.summary.topologyIssues) process.exitCode = 1;
