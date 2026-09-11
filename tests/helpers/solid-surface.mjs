import * as THREE from 'three';

export function surfaceTriangles(geometry) {
  const p = geometry.attributes.position, index = geometry.index, result = [];
  for (let i = 0; i < (index?.count ?? p.count); i += 3) result.push(new THREE.Triangle(...[0, 1, 2]
    .map((j) => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j))));
  return result;
}
export function surfacePoints(geometry) {
  const result = [], seen = new Set();
  const add = (p) => { const key = p.toArray().map((x) => Math.round(x * 1e8)).join(',');
    if (!seen.has(key)) { seen.add(key); result.push(p); } };
  for (const t of surfaceTriangles(geometry)) {
    [t.a, t.b, t.c].forEach(add); add(t.getMidpoint(new THREE.Vector3()));
    for (const [a, b] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) add(a.clone().add(b).multiplyScalar(0.5));
  }
  return result;
}

// A small independent triangle BVH for checking the rendered solids. Signed
// distance uses the winding of the first actual ray intersection, not a
// nominal pitch surface or the model's own contact equations.
export function solidSurface(geometry) {
  const faces = surfaceTriangles(geometry).map((triangle) => ({ triangle,
    box: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]),
    center: triangle.getMidpoint(new THREE.Vector3()), normal: triangle.getNormal(new THREE.Vector3()) }));
  const build = (items) => {
    const box = new THREE.Box3(); for (const f of items) box.union(f.box);
    if (items.length <= 8) return { box, items };
    const size = box.getSize(new THREE.Vector3()), axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
    items.sort((a, b) => a.center[axis] - b.center[axis]); const mid = items.length >> 1;
    return { box, left: build(items.slice(0, mid)), right: build(items.slice(mid)) };
  };
  const root = build(faces), nearest = new THREE.Vector3(), hit = new THREE.Vector3();
  const direction = new THREE.Vector3(0.31217, 0.18723, 1).normalize(), ray = new THREE.Ray();
  const distance = (point, maximum = Infinity) => {
    let best = maximum;
    const visit = (node) => {
      if (node.box.distanceToPoint(point) >= best) return;
      if (node.items) {
        for (const { triangle } of node.items) best = Math.min(best, triangle.closestPointToPoint(point, nearest).distanceTo(point));
      } else { visit(node.left); visit(node.right); }
    };
    visit(root); return best;
  };
  const inside = (point) => {
    if (!root.box.containsPoint(point)) return false;
    ray.set(point, direction); let first = Infinity, orientation = 0;
    const visit = (node) => {
      if (!ray.intersectsBox(node.box)) return;
      if (node.items) {
        for (const { triangle, normal } of node.items) if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) {
          const d = hit.distanceTo(point); if (d < first) { first = d; orientation = normal.dot(direction); }
        }
      } else { visit(node.left); visit(node.right); }
    };
    visit(root); return first > 1e-7 && orientation > 0;
  };
  return { box: root.box, distance, inside, signedDistance: (point, maximum = Infinity) =>
    distance(point, maximum) * (inside(point) ? -1 : 1) };
}
