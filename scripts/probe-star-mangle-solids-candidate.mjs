import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeStarMangleCandidate } from '../artifacts/review/054-candidate-model.mjs';
import { surfaceTriangles } from '../tests/helpers/solid-surface.mjs';

const data = JSON.parse(await readFile(process.env.PROFILE_INPUT ?? 'artifacts/review/054-candidate-profiles-overtravel.json', 'utf8'));
const model = makeStarMangleCandidate(data), seen = new Set(), report = [];
model.root.traverse((part) => {
  const g = part.geometry; if (!g || seen.has(g)) return; seen.add(g);
  const edges = new Map(), directions = new Map(); let volume = 0, zeroFaces = 0, badNormals = 0;
  const faces = surfaceTriangles(g);
  for (const [i, face] of faces.entries()) {
    if (face.getArea() <= 1e-20) zeroFaces += 1;
    const faceNormal = face.getNormal(new THREE.Vector3());
    for (let j = 0; j < 3; j += 1) {
      const index = g.index ? g.index.getX(3 * i + j) : 3 * i + j;
      if (faceNormal.dot(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, index)) <= 0) badNormals += 1;
    }
    volume += face.a.dot(face.b.clone().cross(face.c)) / 6;
    const keys = [face.a, face.b, face.c].map((v) => v.toArray().map((x) => Math.round(x * 1e7)).join(','));
    for (let j = 0; j < 3; j += 1) {
      const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1); directions.set(key, (directions.get(key) ?? 0) + (a < b ? 1 : -1));
    }
  }
  report.push({ type: g.type, faces: faces.length, volume, zeroFaces, badNormals,
    unpairedEdges: [...edges.values()].filter((n) => n !== 2).length,
    inconsistentEdges: [...directions.values()].filter((n) => n !== 0).length,
    profile: g.userData.profileType ?? null, crab: g.userData.firstCrossover ?? null });
});
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/054-candidate-solids.json', JSON.stringify(report, null, 2) + '\n');
const issues = report.filter((r) => r.volume <= 0 || r.zeroFaces || r.badNormals || r.unpairedEdges || r.inconsistentEdges);
console.log(JSON.stringify({ geometries: report.length, issues })); if (issues.length) process.exitCode = 1;
