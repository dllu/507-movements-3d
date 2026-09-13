import * as THREE from 'three';

// Integrate the full inertia tensor of a rigid family in its own coordinates.
// This also supports mechanisms whose shafts point along different axes.
export function rigidFamilyInertia(parts, families, family) {
  let volume = 0;
  const first = [0, 0, 0], second = Array.from({length: 3}, () => [0, 0, 0]);
  for (const [name, mesh] of Object.entries(parts)) if (families[name] === family) {
    mesh.updateMatrix();
    const geometry = mesh.geometry, positions = geometry.attributes.position, index = geometry.index;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map(j => new THREE.Vector3()
        .fromBufferAttribute(positions, index ? index.getX(i + j) : i + j).applyMatrix4(mesh.matrix));
      const v = vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
      const points = vertices.map(p => p.toArray()), sum = first.map((_, k) => points.reduce((s, p) => s + p[k], 0));
      volume += v;
      for (let a = 0; a < 3; a++) {
        first[a] += v * sum[a] / 4;
        for (let b = 0; b < 3; b++) second[a][b] += v * (sum[a] * sum[b] + points.reduce((s, p) => s + p[a] * p[b], 0)) / 20;
      }
    }
  }
  if (!(volume > 0)) throw new RangeError('Invalid rigid-family volume: ' + family);
  const centroid = first.map(v => v / volume);
  const central = second.map((row, a) => row.map((v, b) => v - volume * centroid[a] * centroid[b]));
  const inertia = [central[1][1] + central[2][2], central[0][0] + central[2][2], central[0][0] + central[1][1],
    -central[0][1], -central[0][2], -central[1][2]];
  return {volume, centroid, inertia};
}
