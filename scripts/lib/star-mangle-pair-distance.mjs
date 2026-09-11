import * as THREE from 'three';
import { surfaceTriangles } from '../../tests/helpers/solid-surface.mjs';

export function triangleTree(geometry) {
  const faces = surfaceTriangles(geometry).map((triangle) => ({ triangle,
    box: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]),
    center: triangle.getMidpoint(new THREE.Vector3()) }));
  const build = (items) => {
    const box = new THREE.Box3(); for (const item of items) box.union(item.box);
    if (items.length <= 6) return { box, items };
    const size = box.getSize(new THREE.Vector3()), axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
    items.sort((a, b) => a.center[axis] - b.center[axis]); const middle = items.length >> 1;
    return { box, left: build(items.slice(0, middle)), right: build(items.slice(middle)) };
  };
  return build(faces);
}
function segmentPair(a, b, c, d) {
  const u = b.clone().sub(a), v = d.clone().sub(c), w = a.clone().sub(c);
  const aa = u.lengthSq(), bb = u.dot(v), cc = v.lengthSq(), dd = u.dot(w), ee = v.dot(w), den = aa * cc - bb * bb;
  let s = den > 1e-24 ? THREE.MathUtils.clamp((bb * ee - cc * dd) / den, 0, 1) : 0;
  let t = (bb * s + ee) / cc;
  if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-dd / aa, 0, 1); }
  else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((bb - dd) / aa, 0, 1); }
  return [a.clone().addScaledVector(u, s), c.clone().addScaledVector(v, t)];
}
function trianglePair(a, b, accept) {
  const av = [a.a, a.b, a.c], bv = [b.a, b.b, b.c], point = new THREE.Vector3();
  for (const v of av) { b.closestPointToPoint(v, point); accept(v, point); }
  for (const v of bv) { a.closestPointToPoint(v, point); accept(point, v); }
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) accept(...segmentPair(av[i], av[(i + 1) % 3], bv[j], bv[(j + 1) % 3]));
  // Non-coplanar crossings can lie inside both faces, away from vertices.
  for (const [vertices, target] of [[av, b], [bv, a]]) for (let i = 0; i < 3; i += 1) {
    const edge = vertices[(i + 1) % 3].clone().sub(vertices[i]), length = edge.length();
    const ray = new THREE.Ray(vertices[i], edge.divideScalar(length));
    if (ray.intersectTriangle(target.a, target.b, target.c, false, point) && point.distanceTo(vertices[i]) <= length + 1e-12) accept(point, point);
  }
}

// Exact closest points of the tessellated skins: vertex/face, edge/edge,
// and segment/face intersections. AABB pairs only prune impossible minima.
export function meshPairDistance(aTree, bTree, transform, maximum = 0.01) {
  let best = maximum, witness = null, testedTriangles = 0;
  const boxes = new Map(), triangles = new Map();
  const boxAt = (node) => { if (!boxes.has(node)) boxes.set(node, node.box.clone().applyMatrix4(transform)); return boxes.get(node); };
  const visit = (a, b) => {
    const box = boxAt(a), other = b.box;
    const dx = Math.max(0, box.min.x - other.max.x, other.min.x - box.max.x);
    const dy = Math.max(0, box.min.y - other.max.y, other.min.y - box.max.y);
    const dz = Math.max(0, box.min.z - other.max.z, other.min.z - box.max.z);
    if (dx * dx + dy * dy + dz * dz >= best * best) return;
    if (a.items && b.items) {
      for (const af of a.items) {
        if (!triangles.has(af)) triangles.set(af, new THREE.Triangle(...[af.triangle.a, af.triangle.b, af.triangle.c].map((v) => v.clone().applyMatrix4(transform))));
        const at = triangles.get(af);
        for (const bf of b.items) {
          testedTriangles += 1;
          trianglePair(at, bf.triangle, (pa, pb) => {
            const distance = pa.distanceTo(pb);
            if (distance < best) { best = distance; witness = { a: pa.toArray(), b: pb.toArray(),
              aNormal: at.getNormal(new THREE.Vector3()).toArray(), bNormal: bf.triangle.getNormal(new THREE.Vector3()).toArray() }; }
          });
        }
      }
    } else if (a.items || (!b.items && box.getSize(new THREE.Vector3()).lengthSq() < other.getSize(new THREE.Vector3()).lengthSq())) {
      visit(a, b.left); visit(a, b.right);
    } else { visit(a.left, b); visit(a.right, b); }
  };
  visit(aTree, bTree); return { distance: best, witness, testedTriangles };
}
