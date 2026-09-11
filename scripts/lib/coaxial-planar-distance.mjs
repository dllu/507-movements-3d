// Exact segment distance for the XY boundary of straight extruded gears.
// Boundaries are recovered from the actual Float32 side-wall triangles.
const cross = (a, b) => a.x * b.y - a.y * b.x;
const minus = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export function gearBoundary(mesh) {
  const g = mesh.geometry, p = g.attributes.position; g.computeBoundingBox();
  const top = g.boundingBox.max.z, links = new Map(), vertices = new Map();
  const key = v => `${Math.round(v.x * 1e10)},${Math.round(v.y * 1e10)}`;
  for (let i = 0; i < (g.index?.count ?? p.count); i += 3) {
    const triangle = [0, 1, 2].map(j => { const index = g.index ? g.index.getX(i + j) : i + j;
      return { x: p.getX(index), y: p.getY(index), z: p.getZ(index) }; });
    const edge = triangle.filter(v => v.z === top); if (edge.length !== 2) continue;
    const a = key(edge[0]), b = key(edge[1]); if (a === b) continue;
    vertices.set(a, { x: edge[0].x, y: edge[0].y }); vertices.set(b, { x: edge[1].x, y: edge[1].y });
    for (const [from, to] of [[a, b], [b, a]]) { if (!links.has(from)) links.set(from, new Set()); links.get(from).add(to); }
  }
  const unseen = new Set(vertices.keys()), loops = [];
  while (unseen.size) {
    const start = unseen.values().next().value, loop = []; let current = start, previous = null;
    do {
      if (!unseen.delete(current) || links.get(current).size !== 2) throw new Error('Broken extrusion boundary');
      loop.push(vertices.get(current)); const next = [...links.get(current)].find(v => v !== previous);
      previous = current; current = next;
    } while (current !== start);
    loops.push(loop);
  }
  // The sampled tooth contour is denser than either circular bore/rim.
  loops.sort((a, b) => b.length - a.length);
  if (loops.length !== 2 || loops[0].length < 256) throw new Error('Expected a bored straight gear extrusion');
  return loops[0];
}
export function boundaryIndex(points, cellSize = 0.025) {
  const segments = points.map((a, i) => ({ a, b: points[(i + 1) % points.length] })), cells = new Map();
  const limits = (a, b, padding = 0) => [Math.floor((Math.min(a.x, b.x) - padding) / cellSize), Math.floor((Math.max(a.x, b.x) + padding) / cellSize),
    Math.floor((Math.min(a.y, b.y) - padding) / cellSize), Math.floor((Math.max(a.y, b.y) + padding) / cellSize)];
  for (const segment of segments) {
    const [x0, x1, y0, y1] = limits(segment.a, segment.b);
    for (let x = x0; x <= x1; x += 1) for (let y = y0; y <= y1; y += 1) {
      const key = `${x},${y}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(segment);
    }
  }
  return { cells, limits };
}
export function planarPairDistance(input, target, transform, maximum = 0.01, acceptsWitness = null) {
  const e = transform.elements;
  const points = input.map(v => ({ x: e[0] * v.x + e[4] * v.y + e[12], y: e[1] * v.x + e[5] * v.y + e[13] }));
  let best = maximum ** 2, witness = null, intersections = 0, checkedPairs = 0;
  // An optional load-direction predicate can select either physical flank.
  // Crossing counts remain unconditional, including rejected zero-gap points.
  const accept = (a, b) => { const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2; if (d < best && (!acceptsWitness || acceptsWitness(a, b))) { best = d; witness = { a, b }; } };
  const pointSegment = (point, a, b, reverse = false) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const u = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    const q = { x: a.x + u * dx, y: a.y + u * dy };
    if (reverse) accept(q, point); else accept(point, q);
  };
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length], seen = new Set();
    const [x0, x1, y0, y1] = target.limits(a, b, Math.sqrt(best) + 1e-10);
    for (let x = x0; x <= x1; x += 1) for (let y = y0; y <= y1; y += 1) for (const other of target.cells.get(`${x},${y}`) ?? []) {
      if (seen.has(other)) continue; seen.add(other); checkedPairs += 1;
      const c = other.a, d = other.b, ab = minus(b, a), cd = minus(d, c), ca = minus(c, a), denominator = cross(ab, cd);
      if (Math.abs(denominator) > 1e-20) {
        const u = cross(ca, cd) / denominator, v = cross(ca, ab) / denominator;
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          intersections += 1; const point = { x: a.x + u * ab.x, y: a.y + u * ab.y }; accept(point, point); continue;
        }
      }
      pointSegment(a, c, d); pointSegment(b, c, d); pointSegment(c, a, b, true); pointSegment(d, a, b, true);
    }
  }
  return { distance: Math.sqrt(best), witness, intersections, checkedPairs };
}
