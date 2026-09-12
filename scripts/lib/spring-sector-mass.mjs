import {surfaceTriangles} from '../../tests/helpers/solid-surface.mjs';

// Signed-tetrahedron volume, first moments and full second moments of the
// rendered closed meshes, in each rigid family's coordinates. Components in
// the freely moving families meet at faces and have no overlapping volume.
export function springSectorFamilyMass(candidate, family) {
  const u = candidate.root.userData, first = [0, 0, 0], second = Array.from({length: 3}, () => [0, 0, 0]);
  let volume = 0, triangles = 0;
  for (const [name, mesh] of Object.entries(u.parts)) if (u.families[name] === family) {
    mesh.updateMatrix();
    for (const t of surfaceTriangles(mesh.geometry)) {
      const vectors = [t.a, t.b, t.c].map(v => v.clone().applyMatrix4(mesh.matrix));
      const v = vectors[0].dot(vectors[1].clone().cross(vectors[2])) / 6;
      const points = vectors.map(p => p.toArray()), sum = [0, 1, 2].map(i => points.reduce((s, p) => s + p[i], 0));
      volume += v; triangles++;
      for (let i = 0; i < 3; i++) {
        first[i] += v * sum[i] / 4;
        for (let j = 0; j < 3; j++) second[i][j] += v * (sum[i] * sum[j] + points.reduce((s, p) => s + p[i] * p[j], 0)) / 20;
      }
    }
  }
  if (!(volume > 0)) throw Error('Invalid rigid-family volume: ' + family);
  return {family, volume, first, second, centroid: first.map(v => v / volume),
    polarZ: second[0][0] + second[1][1], polarY: second[0][0] + second[2][2], triangles};
}
