// Recover a simple unbored plate boundary from its actual Float32 side walls.
export function extrudedPlateContour(geometry) {
  geometry.computeBoundingBox();
  const p = geometry.attributes.position, top = geometry.boundingBox.max.z;
  const links = new Map(), vertices = new Map();
  const key = v => v.map(x => Math.round(x * 1e10)).join(',');
  for (let i = 0; i < (geometry.index?.count ?? p.count); i += 3) {
    const edge = [0, 1, 2].map(j => geometry.index ? geometry.index.getX(i + j) : i + j)
      .filter(index => p.getZ(index) === top).map(index => [p.getX(index), p.getY(index)]);
    if (edge.length !== 2) continue;
    const a = key(edge[0]), b = key(edge[1]); if (a === b) continue;
    vertices.set(a, edge[0]); vertices.set(b, edge[1]);
    for (const [from, to] of [[a,b],[b,a]]) { if (!links.has(from)) links.set(from, new Set()); links.get(from).add(to); }
  }
  const unseen = new Set(vertices.keys()), start = unseen.values().next().value, ring = [];
  let current = start, previous = null;
  do {
    if (!unseen.delete(current) || links.get(current)?.size !== 2) throw new Error('Broken plate boundary');
    ring.push(vertices.get(current));
    const next = [...links.get(current)].find(key => key !== previous); previous = current; current = next;
  } while (current !== start);
  if (unseen.size) throw new Error('Expected exactly one plate boundary');
  const area = ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
  if (area < 0) ring.reverse();
  return ring;
}
