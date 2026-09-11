import * as THREE from 'three';

// Cut a spiral ledge along the same conical helix as the chain pins.
// Patches are clipped at the real top/bottom planes before triangulation,
// leaving a continuous groove and its open ends instead of a raised wire.
export function groovedFuseeGeometry(parameters, {
  angularSegments = 512, grooveHalfWidth = 0.096,
  floorOffset = -0.021, topRadius = 0.555, bottomRadius = 1.18,
  bodyTop = parameters.fuseeZTop + 0.05,
  bodyBottom = parameters.fuseeZBottom - 0.05,
} = {}) {
  const p = parameters, height = p.fuseeZTop - p.fuseeZBottom;
  const radiusChange = p.fuseeBottomRadius - p.fuseeTopRadius;
  const grooveAngle = 2 * Math.PI * p.grooveTurns;
  const halfProgress = grooveHalfWidth / height;
  const ends = [(p.fuseeZTop - bodyTop) / height, (p.fuseeZTop - bodyBottom) / height];
  const ceilingSlope = (bottomRadius - topRadius) / (ends[1] - ends[0]);
  const ceiling = (u) => topRadius + ceilingSlope * (u - ends[0]);
  const positions = [], normals = [], capEdges = [[], []];
  const pointAt = (v) => {
    const r = v.r;
    return new THREE.Vector3(r * Math.cos(v.theta), r * Math.sin(v.theta), p.fuseeZTop - height * v.u);
  };
  const normalAt = (v, wallSign, atCeiling) => {
    const r = v.r;
    if (!wallSign) {
      if (atCeiling) return new THREE.Vector3(Math.cos(v.theta), Math.sin(v.theta), ceilingSlope / height).normalize();
      const slope = radiusChange / (grooveAngle * r);
      return new THREE.Vector3(Math.cos(v.theta) + slope * Math.sin(v.theta),
        Math.sin(v.theta) - slope * Math.cos(v.theta), 0).normalize();
    }
    return new THREE.Vector3(Math.sin(v.theta) / (grooveAngle * r),
      -Math.cos(v.theta) / (grooveAngle * r), -1 / height).multiplyScalar(wallSign).normalize();
  };
  const emit = (a, b, c, na, nb, nc) => {
    const cross = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (cross.lengthSq() < 1e-24) return;
    if (cross.dot(na.clone().add(nb).add(nc)) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    for (const v of [a, b, c]) positions.push(v.x, v.y, v.z);
    for (const n of [na, nb, nc]) normals.push(n.x, n.y, n.z);
  };
  const clip = (polygon, limit, keepAbove, coordinate = (v) => v.u) => {
    const output = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const va = coordinate(a), vb = coordinate(b);
      const insideA = keepAbove ? va >= limit : va <= limit;
      const insideB = keepAbove ? vb >= limit : vb <= limit;
      if (insideA) output.push(a);
      if (insideA !== insideB) {
        const fraction = (limit - va) / (vb - va);
        output.push({ u: THREE.MathUtils.lerp(a.u, b.u, fraction), theta: THREE.MathUtils.lerp(a.theta, b.theta, fraction),
          r: THREE.MathUtils.lerp(a.r, b.r, fraction) });
      }
    }
    return output;
  };
  const emitPatch = (polygon, wallSign, atCeiling = false) => {
    if (polygon.length < 3) return;
    const points = polygon.map(pointAt), ns = polygon.map((v) => normalAt(v, wallSign, atCeiling));
    for (let i = 1; i + 1 < points.length; i += 1) emit(points[0], points[i], points[i + 1], ns[0], ns[i], ns[i + 1]);
    for (let i = 0; i < polygon.length; i += 1) {
      const next = (i + 1) % polygon.length;
      for (const end of [0, 1]) {
        if (Math.abs(polygon[i].u - ends[end]) < 1e-12 && Math.abs(polygon[next].u - ends[end]) < 1e-12
          && points[i].distanceToSquared(points[next]) > 1e-20) {
          capEdges[end].push([points[i], points[next]]);
        }
      }
    }
  };
  const patch = (corners, wallSign = 0) => {
    const polygon = clip(clip(corners, ends[0], true), ends[1], false);
    if (polygon.length < 3) return;
    const difference = (v) => v.r - ceiling(v.u);
    emitPatch(clip(polygon, 0, false, difference), wallSign);
    if (!wallSign && polygon.some((v) => difference(v) > 1e-12)) {
      emitPatch(clip(polygon, 0, true, difference).map((v) => ({ ...v, r: ceiling(v.u) })), 0, true);
    }
  };
  const vertex = (theta, u, center) => ({ theta, u,
    r: p.fuseeTopRadius + radiusChange * center + floorOffset });
  for (let segment = 0; segment < angularSegments; segment += 1) {
    const a = 2 * Math.PI * segment / angularSegments, b = 2 * Math.PI * (segment + 1) / angularSegments;
    for (let turn = -2; turn <= Math.ceil(p.grooveTurns) + 1; turn += 1) {
      const ua = turn / p.grooveTurns + a / grooveAngle;
      const ub = turn / p.grooveTurns + b / grooveAngle;
      const nextA = ua + 1 / p.grooveTurns, nextB = ub + 1 / p.grooveTurns;
      patch([vertex(a, ua - halfProgress, ua), vertex(b, ub - halfProgress, ub),
        vertex(b, ub + halfProgress, ub), vertex(a, ua + halfProgress, ua)]);
      patch([vertex(a, ua + halfProgress, nextA), vertex(b, ub + halfProgress, nextB),
        vertex(b, nextB - halfProgress, nextB), vertex(a, nextA - halfProgress, nextA)]);
      patch([vertex(a, ua + halfProgress, ua), vertex(b, ub + halfProgress, ub),
        vertex(b, ub + halfProgress, nextB), vertex(a, ua + halfProgress, nextA)], -1);
    }
  }
  for (const end of [0, 1]) {
    const nodes = new Map();
    const key = (point) => `${Math.round(point.x * 1e8)},${Math.round(point.y * 1e8)}`;
    for (const [a, b] of capEdges[end]) {
      const ka = key(a), kb = key(b);
      if (ka === kb) continue;
      if (!nodes.has(ka)) nodes.set(ka, { point: a, neighbors: new Set() });
      if (!nodes.has(kb)) nodes.set(kb, { point: b, neighbors: new Set() });
      nodes.get(ka).neighbors.add(kb);
      nodes.get(kb).neighbors.add(ka);
    }
    const contour = [], first = nodes.keys().next().value;
    let current = first, previous = null;
    do {
      const node = nodes.get(current);
      if (node.neighbors.size !== 2) throw new Error('Fusee cap boundary is not a closed loop');
      contour.push(new THREE.Vector2(node.point.x, node.point.y));
      const next = [...node.neighbors].find((neighbor) => neighbor !== previous);
      previous = current;
      current = next;
      if (contour.length > nodes.size) throw new Error('Fusee cap boundary repeats');
    } while (current !== first);
    if (contour.length !== nodes.size) throw new Error('Fusee cap boundary has disconnected pieces');
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    const z = end === 0 ? bodyTop : bodyBottom;
    const normal = new THREE.Vector3(0, 0, end === 0 ? 1 : -1);
    for (const triangle of triangles) {
      const points = triangle.map((i) => new THREE.Vector3(contour[i].x, contour[i].y, z));
      emit(...points, normal, normal, normal);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = { angularSegments, grooveHalfWidth, floorOffset, topRadius, bottomRadius,
    grooveTurns: p.grooveTurns, bodyTop, bodyBottom, machinedHelicalGroove: true };
  return geometry;
}
