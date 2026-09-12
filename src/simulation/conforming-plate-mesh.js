import * as THREE from 'three';

// Earcut may bridge aligned holes with a cap edge passing through another
// boundary vertex. Split such triangle edges without moving the plate contour.
// This helper operates on the already rounded mesh positions, not source curves.
export function conformingPlateMesh(input) {
  const mesh = input.index ? input.toNonIndexed() : input;
  const positions = mesh.attributes.position, unique = new Map();
  for (let i = 0; i < positions.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(positions, i); unique.set(p.toArray().join(','), p);
  }
  const vertices = [...unique.values()], output = [];
  let splitTriangles = 0, addedEdgePoints = 0, maximumEdgeDistance = 0;
  for (let i = 0; i < positions.count; i += 3) {
    const triangle = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(positions, i + j)), boundary = [];
    let split = false;
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge], b = triangle[(edge + 1) % 3], direction = b.clone().sub(a), length2 = direction.lengthSq();
      if (!(length2 > 0)) throw Error('Degenerate plate edge');
      const interior = [];
      for (const p of vertices) {
        const t = p.clone().sub(a).dot(direction) / length2;
        if (t <= 1e-10 || t >= 1 - 1e-10) continue;
        const distance = a.clone().addScaledVector(direction, t).distanceTo(p);
        if (distance > 1e-10) continue;
        interior.push({p, t}); maximumEdgeDistance = Math.max(maximumEdgeDistance, distance);
      }
      boundary.push(a, ...interior.sort((a, b) => a.t - b.t).map(item => item.p));
      addedEdgePoints += interior.length; split ||= interior.length > 0;
    }
    if (!split) {for (const p of triangle) output.push(...p.toArray()); continue;}
    splitTriangles++;
    const center = triangle[0].clone().add(triangle[1]).add(triangle[2]).multiplyScalar(1 / 3);
    for (let j = 0; j < boundary.length; j++)
      for (const p of [center, boundary[j], boundary[(j + 1) % boundary.length]]) output.push(...p.toArray());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(output, 3)); geometry.computeVertexNormals();
  geometry.userData = {...input.userData, conformity: {splitTriangles, addedEdgePoints, maximumEdgeDistance,
    originalTriangles: positions.count / 3, triangles: output.length / 9}};
  if (mesh !== input) mesh.dispose(); input.dispose(); return geometry;
}
