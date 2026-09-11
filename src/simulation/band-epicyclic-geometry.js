import * as THREE from 'three';

export const involute = radiusRatio => {
  const t = Math.sqrt(Math.max(0, radiusRatio * radiusRatio - 1));
  return t - Math.atan(t);
};

function extrusion(outside, holes, depth) {
  const clean = values => {
    const points = values.map(v => new THREE.Vector2(Math.fround(v.x), Math.fround(v.y)));
    if (points[0].equals(points.at(-1))) points.pop();
    for (let i = points.length - 1; i >= 0 && points.length > 3; i -= 1) {
      const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
      if ((b.x - a.x) * (c.y - b.y) === (b.y - a.y) * (c.x - b.x)) points.splice(i, 1);
    }
    return points;
  };
  const contour = clean(outside); if (!THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
  const shape = new THREE.Shape(contour);
  for (const points of holes.map(clean)) {
    if (THREE.ShapeUtils.isClockWise(points)) points.reverse();
    shape.holes.push(new THREE.Path(points));
  }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

export function bandProfileExtrusion(shape, low, high) {
  const points = shape.extractPoints(96);
  return extrusion(points.shape, points.holes, high - low).translate(0, 0, (low + high) / 2);
}

export function bandInvoluteGear({ teeth, baseRadius, baseHalfAngle, rootRadius, tipRadius,
  boreRadius = 0.13, outerRadius, internal = false, depth = 0.22, flankSamples = 256 }) {
  const pitch = 2 * Math.PI / teeth, outline = [];
  const halfAngle = r => baseHalfAngle + (internal ? 1 : -1) * involute(r / baseRadius);
  const rootHalf = halfAngle(rootRadius), tipHalf = halfAngle(tipRadius);
  if (Math.min(rootHalf, tipHalf) <= 0 || Math.max(rootHalf, tipHalf) >= pitch / 2) throw new RangeError(`Invalid tooth width: ${teeth}, ${rootHalf}, ${tipHalf}`);
  const point = (r, angle) => outline.push(new THREE.Vector2(r * Math.cos(angle), r * Math.sin(angle)));
  const circle = (r, a, b, count) => { for (let i = 1; i <= count; i += 1) point(r, a + (b - a) * i / count); };
  const parameter = r => Math.sqrt(Math.max(0, (r / baseRadius) ** 2 - 1));
  const t0 = parameter(rootRadius), t1 = parameter(tipRadius);
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const center = tooth * pitch;
    point(rootRadius, center - rootHalf);
    for (let i = 0; i <= flankSamples; i += 1) {
      const t = t0 + (t1 - t0) * i / flankSamples, r = baseRadius * Math.sqrt(1 + t * t);
      point(r, center - halfAngle(r));
    }
    circle(tipRadius, center - tipHalf, center + tipHalf, 16);
    for (let i = flankSamples - 1; i >= 0; i -= 1) {
      const t = t0 + (t1 - t0) * i / flankSamples, r = baseRadius * Math.sqrt(1 + t * t);
      point(r, center + halfAngle(r));
    }
    if (rootRadius < baseRadius) point(rootRadius, center + rootHalf);
    circle(rootRadius, center + rootHalf, center + pitch - rootHalf, 16);
  }
  const circular = r => Array.from({ length: 512 }, (_, i) => new THREE.Vector2(r * Math.cos(2 * Math.PI * i / 512), r * Math.sin(2 * Math.PI * i / 512)));
  const geometry = internal ? extrusion(circular(outerRadius), [outline], depth) : extrusion(outline, [circular(boreRadius)], depth);
  geometry.userData = { teeth, baseRadius, baseHalfAngle, rootRadius, tipRadius, boreRadius, outerRadius, internal, depth,
    basePitch: 2 * Math.PI * baseRadius / teeth, rootHalf, tipHalf, outline, toothProfile: 'involute-with-independent-working-pressure-angles' };
  return geometry;
}
