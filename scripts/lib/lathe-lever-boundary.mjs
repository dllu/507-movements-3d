import * as THREE from 'three';

// Recover every closed top contour from the actual extrusion side walls.
export function extrudedLoops(mesh) {
  const g = mesh.geometry, position = g.attributes.position; g.computeBoundingBox();
  const top = g.boundingBox.max.z, links = new Map(), points = new Map();
  const key = v => `${v.x},${v.y}`;
  for (let i = 0; i < (g.index?.count ?? position.count); i += 3) {
    const face = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, g.index ? g.index.getX(i + j) : i + j));
    const edge = face.filter(v => v.z === top); if (edge.length !== 2) continue;
    const a = key(edge[0]), b = key(edge[1]); if (a === b) continue;
    points.set(a, edge[0]); points.set(b, edge[1]);
    for (const [from, to] of [[a, b], [b, a]]) { if (!links.has(from)) links.set(from, new Set()); links.get(from).add(to); }
  }
  const unseen = new Set(points.keys()), loops = [];
  while (unseen.size) {
    const start = unseen.values().next().value, loop = []; let current = start, previous = null;
    do {
      if (!unseen.delete(current) || links.get(current).size !== 2) throw new Error(`Broken boundary: ${mesh.name}`);
      loop.push(points.get(current)); const next = [...links.get(current)].find(v => v !== previous);
      previous = current; current = next;
    } while (current !== start);
    loops.push(loop);
  }
  return loops;
}
