import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeSpringJumpCam } from '../src/simulation/spring-jump-cam.js';

const model = makeSpringJumpCam(), { parts, geometry: p } = model.root.userData;
function audit(geometry) {
  const position = geometry.attributes.position, normal = geometry.attributes.normal, index = geometry.index;
  const edges = new Map(), vertex = i => new THREE.Vector3().fromBufferAttribute(position, i);
  const key = v => v.toArray().map(x => Math.round(x * 1e9)).join(',');
  let volume = 0, triangles = 0, degenerate = 0, wrongNormals = 0, minimumNormalDot = 1;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j), [a, b, c] = ids.map(vertex);
    const cross = b.clone().sub(a).cross(c.clone().sub(a));
    if (cross.lengthSq() < 1e-22) { degenerate += 1; continue; }
    triangles += 1; volume += a.dot(b.clone().cross(c)) / 6;
    const meanNormal = ids.reduce((sum, j) => sum.add(new THREE.Vector3().fromBufferAttribute(normal, j)), new THREE.Vector3()).normalize();
    const dot = cross.normalize().dot(meanNormal); minimumNormalDot = Math.min(minimumNormalDot, dot); if (dot < 0) wrongNormals += 1;
    const keys = [a, b, c].map(key);
    for (let j = 0; j < 3; j += 1) {
      const from = keys[j], to = keys[(j + 1) % 3]; if (from === to) continue;
      const name = from < to ? `${from}/${to}` : `${to}/${from}`, edge = edges.get(name) ?? { count: 0, orientation: 0 };
      edge.count += 1; edge.orientation += from < to ? 1 : -1; edges.set(name, edge);
    }
  }
  const bad = [...edges].filter(([, e]) => e.count !== 2 || e.orientation !== 0);
  return { triangles, degenerate, volume, minimumNormalDot, wrongNormals, unmatchedEdges: bad.length, examples: bad.slice(0, 5) };
}
const rows = Object.entries(parts).map(([name, mesh]) => ({ name, ...audit(mesh.geometry) }));
for (const time of [p.releaseTime + 0.2, 2, 5, p.catchTime, 12]) {
  model.update(time); rows.push({ name: 'leafSpring', time, ...audit(parts.leafSpring.geometry) });
}
const report = { movement: 64,
  method: 'Actual Float32 triangle winding, signed volume, stored-normal alignment and paired oriented edges, merging coordinates at 1e-9 model units. All 20 parts, plus the deformed spring in five more poses. The earlier 1e-7 bin size collapsed four valid narrow worm-cap triangles into edges and falsely counted four incident faces. This is topology/normal verification, not an inter-part clearance test.',
  rows, issues: rows.filter(row => row.volume <= 0 || row.wrongNormals || row.unmatchedEdges) };
await writeFile('artifacts/review/064-candidate-solids.json', JSON.stringify(report, null, 2) + '\n');
console.log(report); if (report.issues.length) process.exitCode = 1;
