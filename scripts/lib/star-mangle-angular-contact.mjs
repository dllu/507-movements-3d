import * as THREE from 'three';

const turn = 2 * Math.PI;
const mod = (a, n) => ((a % n) + n) % n;
const pinionSkins = new WeakMap();
function circleSegment(a, b, radiusSquared, visit) {
  const dx = b.x - a.x, dy = b.y - a.y, aa = dx * dx + dy * dy;
  if (aa < 1e-24) return;
  const bb = a.x * dx + a.y * dy, cc = a.x * a.x + a.y * a.y - radiusSquared;
  const discriminant = bb * bb - aa * cc;
  if (discriminant < -1e-18) return;
  const root = Math.sqrt(Math.max(0, discriminant));
  for (const t of [(-bb - root) / aa, (-bb + root) / aa]) if (t >= -1e-12 && t <= 1 + 1e-12) {
    visit(a.x + t * dx, a.y + t * dy, THREE.MathUtils.clamp(t, 0, 1));
  }
}
function clipAxial(polygon, z, sign) {
  const result = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const insideA = sign * (a.z - z) >= 0, insideB = sign * (b.z - z) >= 0;
    if (insideA) result.push(a);
    if (insideA !== insideB) result.push(a.clone().lerp(b, (z - a.z) / (b.z - a.z)));
  }
  return result;
}

// For a spur pinion, clipping each mating triangle to its axial slab
// reduces the first rotating contact to exact 2D vertex/edge events. Both
// directions are necessary: a wheel vertex can meet a pinion edge, or a
// pinion vertex can meet a wheel edge. Circle/segment roots locate those
// events without time stepping or a vertex-only penetration surrogate.
export function firstPinionContact({ teeth, pinion, maximumAdvance = 0.03 }) {
  const pinionGeometry = pinion.geometry;
  if (!pinionSkins.has(pinionGeometry)) {
    // Extrusion stores float32 positions. Contact near a grazing tip must
    // use those same coordinates, including the actual axial end planes.
    const outline = pinionGeometry.userData.outline.map(v => new THREE.Vector2(Math.fround(v.x), Math.fround(v.y)));
    if (!pinionGeometry.boundingBox) pinionGeometry.computeBoundingBox();
    pinionSkins.set(pinionGeometry, { outline, outerSquared: Math.max(...outline.map(v => v.lengthSq())),
      axialMin: pinionGeometry.boundingBox.min.z, axialMax: pinionGeometry.boundingBox.max.z });
  }
  const { outline, outerSquared, axialMin, axialMax } = pinionSkins.get(pinionGeometry);
  const n = outline.length, angularStep = turn / n;
  const initialAngle = Math.atan2(outline[0].y, outline[0].x), inverse = pinion.matrixWorld.clone().invert();
  let advance = maximumAdvance, witness = null, triangleCount = 0;
  const accept = (delta, point, tooth, type) => {
    if (delta < advance) { advance = delta; witness = { point: point.toArray(), tooth: tooth.userData.index, type }; }
  };
  for (const tooth of teeth) {
    const transform = inverse.clone().multiply(tooth.matrixWorld), geometry = tooth.geometry;
    const box = geometry.boundingBox.clone().applyMatrix4(transform);
    const minX = Math.max(0, box.min.x, -box.max.x), minY = Math.max(0, box.min.y, -box.max.y);
    if (box.min.z > axialMax || box.max.z < axialMin || minX * minX + minY * minY > outerSquared) continue;
    const positions = geometry.attributes.position, index = geometry.index;
    const points = Array.from({ length: positions.count }, (_, i) => {
      const v = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(transform); v.contactIndex = i; return v;
    });
    const visitedPoints = new Set(), visitedEdges = new Set();
    const pointKey = (v) => v.contactIndex !== undefined ? String(v.contactIndex) : v.toArray().map((x) => x.toPrecision(14)).join(',');
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      let polygon = [0, 1, 2].map((j) => points[index ? index.getX(i + j) : i + j]);
      polygon = clipAxial(clipAxial(polygon, axialMin, 1), axialMax, -1);
      if (polygon.length < 2) continue;
      triangleCount += 1;
      for (let j = 0; j < polygon.length; j += 1) {
        const a = polygon[j], b = polygon[(j + 1) % polygon.length], keyA = pointKey(a), keyB = pointKey(b);
        const angle = Math.atan2(a.y, a.x), radiusSquared = a.x * a.x + a.y * a.y;
        if (!visitedPoints.has(keyA) && radiusSquared <= outerSquared + 1e-12) {
          visitedPoints.add(keyA);
          const first = Math.floor((angle - advance - initialAngle) / angularStep) - 1, last = Math.floor((angle - initialAngle) / angularStep) + 1;
          for (let k = first; k <= last; k += 1) circleSegment(outline[mod(k, n)], outline[mod(k + 1, n)], radiusSquared, (x, y) => {
            const delta = mod(angle - Math.atan2(y, x), turn);
            if (delta <= advance) accept(delta, a, tooth, 'wheel-vertex-to-pinion-edge');
          });
        }
        const edgeKey = keyA < keyB ? `${keyA}/${keyB}` : `${keyB}/${keyA}`;
        if (visitedEdges.has(edgeKey)) continue; visitedEdges.add(edgeKey);
        const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
        if (lengthSquared < 1e-24) continue;
        const t = THREE.MathUtils.clamp(-(a.x * dx + a.y * dy) / lengthSquared, 0, 1);
        const minimumSquared = (a.x + t * dx) ** 2 + (a.y + t * dy) ** 2;
        if (minimumSquared > outerSquared + 1e-12) continue;
        const maximumSquared = Math.max(radiusSquared, b.x * b.x + b.y * b.y);
        const endAngle = angle + Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
        const first = Math.ceil((Math.min(angle, endAngle) - advance - initialAngle) / angularStep) - 1;
        const last = Math.floor((Math.max(angle, endAngle) - initialAngle) / angularStep) + 1;
        for (let k = first; k <= last; k += 1) {
          const v = outline[mod(k, n)], vr = v.lengthSq();
          if (vr < minimumSquared - 1e-12 || vr > maximumSquared + 1e-12) continue;
          circleSegment(a, b, vr, (x, y, fraction) => {
            const delta = mod(Math.atan2(y, x) - Math.atan2(v.y, v.x), turn);
            if (delta <= advance) accept(delta, a.clone().lerp(b, fraction), tooth, 'pinion-vertex-to-wheel-edge');
          });
        }
      }
    }
  }
  return { advance, witness, triangleCount };
}
