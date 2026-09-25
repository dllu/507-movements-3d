import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { curvedPipeWall } from './finite-fluid-passages.js';

// A symmetric Y fork of round pipe (two legs joining one stem) as one hollow
// wall. `halfCurve` runs from the left leg's mouth, through the fork, and on
// up the stem on x = 0; its pipe is cut at the symmetry plane x = 0 and
// joined to its mirror image. The cut sections coincide exactly, so the
// legs merge into the stem with a clean crotch and no internal walls.
// `cut(point)` marks where another pipe passes through the wall: triangles
// whose corners all satisfy it are left out, leaving a port for that pipe.
// The port edge is then ragged by up to one triangle, so the cut radius is
// set to the passing pipe's outer radius and the edge hides inside its wall.
export function mirroredForkWall(halfCurve, inner, outer, { segments = 220, sides = 72, cut = null } = {}) {
  const pipe = curvedPipeWall(halfCurve, inner, outer, segments, sides).toNonIndexed();
  const source = pipe.attributes.position;
  const left = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const clipTriangle = (points) => {
    // Sutherland-Hodgman against x <= 0.
    const out = [];
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i], q = points[(i + 1) % points.length];
      const pIn = p.x <= 0, qIn = q.x <= 0;
      if (pIn) out.push(p);
      if (pIn !== qIn) {
        const t = p.x / (p.x - q.x);
        const r = p.clone().lerp(q, t);
        r.x = 0;
        out.push(r);
      }
    }
    for (let i = 1; i + 1 < out.length; i += 1) left.push(out[0], out[i], out[i + 1]);
  };
  for (let i = 0; i < source.count; i += 3) {
    a.fromBufferAttribute(source, i); b.fromBufferAttribute(source, i + 1); c.fromBufferAttribute(source, i + 2);
    if (a.x > 0 && b.x > 0 && c.x > 0) continue;
    clipTriangle([a.clone(), b.clone(), c.clone()]);
  }
  pipe.dispose();
  const positions = new Float32Array(left.length * 6);
  left.forEach((p, i) => positions.set([p.x, p.y, p.z], i * 3));
  // Mirror to the right half, reversing winding.
  const offset = left.length * 3;
  for (let i = 0; i < left.length; i += 3) {
    for (const [k, source] of [[0, 0], [1, 2], [2, 1]]) {
      const p = left[i + source];
      positions.set([-p.x, p.y, p.z], offset + (i + k) * 3);
    }
  }
  let kept = positions;
  if (cut) {
    const out = [], p = new THREE.Vector3();
    for (let i = 0; i < positions.length; i += 9) {
      let inside = true;
      for (let k = 0; k < 3 && inside; k += 1) inside = cut(p.fromArray(positions, i + k * 3));
      if (!inside) for (let k = 0; k < 9; k += 1) out.push(positions[i + k]);
    }
    kept = new Float32Array(out);
  }
  const soup = new THREE.BufferGeometry();
  soup.setAttribute('position', new THREE.BufferAttribute(kept, 3));
  const geometry = mergeVertices(soup, 1e-5);
  soup.dispose();
  geometry.computeVertexNormals();
  return geometry;
}
