import * as THREE from 'three';
import { surfaceTriangles } from './solid-surface.mjs';

// Samples with roughly `step` spacing across each triangle, including face
// interiors of coarse boxes and prisms. Rows run from the longest edge to the
// opposite vertex, so long slivers cost O(length/step), not O((length/step)^2).
export function densePoints(geometry, step = 0.03) {
  const out = [], start = new THREE.Vector3();
  for (const triangle of surfaceTriangles(geometry)) {
    const edges = [[triangle.a, triangle.b, triangle.c], [triangle.b, triangle.c, triangle.a], [triangle.c, triangle.a, triangle.b]];
    const [p, q, apex] = edges.reduce((best, edge) => (edge[0].distanceTo(edge[1]) > best[0].distanceTo(best[1]) ? edge : best));
    const length = p.distanceTo(q), height = 2 * triangle.getArea() / length;
    const along = Math.max(1, Math.ceil(length / step)), across = Math.max(1, Math.ceil(height / step));
    for (let j = 0; j <= across; j += 1) {
      const t = j / across, count = Math.max(1, Math.ceil(along * (1 - t)));
      for (let i = 0; i <= count; i += 1) {
        start.lerpVectors(p, q, i / count);
        out.push(start.clone().lerp(apex, t));
      }
    }
  }
  return out;
}
