import * as THREE from 'three';

export function radialToothGeometry(profile, { outerRadius } = {}) {
  let { radii, heights } = profile;
  const n = profile.angularSamples, vertices = [], indices = [];
  if (outerRadius !== undefined && outerRadius < radii.at(-1)) {
    const upper = radii.findIndex((r) => r >= outerRadius);
    if (upper <= 0) throw new RangeError('The trimmed tooth must retain positive radial length.');
    const fraction = (outerRadius - radii[upper - 1]) / (radii[upper] - radii[upper - 1]);
    const row = heights[upper].map((h, j) => THREE.MathUtils.lerp(heights[upper - 1][j], h, fraction));
    radii = [...radii.slice(0, upper), outerRadius]; heights = [...heights.slice(0, upper), row];
  }
  for (let i = 0; i < radii.length; i += 1) for (let j = 0; j < n; j += 1) {
    const angle = 2 * Math.PI * j / n;
    vertices.push(radii[i], heights[i][j] * Math.cos(angle), heights[i][j] * Math.sin(angle));
  }
  for (let i = 0; i + 1 < radii.length; i += 1) for (let j = 0; j < n; j += 1) {
    const a = i * n + j, b = i * n + (j + 1) % n, c = b + n, d = a + n;
    indices.push(a, b, c, a, c, d);
  }
  for (const [row, direction] of [[0, -1], [radii.length - 1, 1]]) {
    const center = vertices.length / 3; vertices.push(radii[row], 0, 0);
    for (let j = 0; j < n; j += 1) {
      const a = row * n + j, b = row * n + (j + 1) % n;
      indices.push(center, direction === 1 ? a : b, direction === 1 ? b : a);
    }
  }
  // Retain a crease at the cut shoulders and radial end caps. Averaging a
  // cap with a steep return face can turn its vertex normal into the solid.
  const faceNormals = [], incident = Array.from({ length: vertices.length / 3 }, () => []);
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map(j => new THREE.Vector3().fromArray(vertices, 3 * j));
    const normal = points[1].sub(points[0]).cross(points[2].sub(points[0])).normalize();
    faceNormals.push(normal);
    for (let j = 0; j < 3; j += 1) incident[indices[i + j]].push(i / 3);
  }
  const creasedPositions = [], creasedNormals = [], creasedIndices = [], smoothingVertices = new Map();
  for (let i = 0; i < indices.length; i += 1) {
    const vertex = indices[i], normal = faceNormals[Math.floor(i / 3)];
    const neighbors = incident[vertex].filter(f => normal.dot(faceNormals[f]) > 0.5);
    const key = `${vertex}/${neighbors.join(',')}`;
    if (!smoothingVertices.has(key)) {
      smoothingVertices.set(key, creasedPositions.length / 3);
      creasedPositions.push(...vertices.slice(3 * vertex, 3 * vertex + 3));
      const average = neighbors.reduce((sum, f) => sum.add(faceNormals[f]), new THREE.Vector3()).normalize();
      creasedNormals.push(...average.toArray());
    }
    creasedIndices.push(smoothingVertices.get(key));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(creasedPositions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(creasedNormals, 3)); geometry.setIndex(creasedIndices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { profileType: 'synchronized-involute-cutter-radial-loft', ...profile,
    meshedRadii: radii, trimmedOuterRadius: outerRadius ?? null };
  return geometry;
}
