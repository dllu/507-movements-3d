import {plate, poly, polygonClipping} from './finite-plate-geometry.js';

// Brown stands his rotary-engine casings (426-428) on one cast foot: a flat
// pad whose ends rise in concave flanks into the underside of the round
// casing. The top of the outline follows an arc just inside the casing's
// outer radius, so the foot merges with the wall without entering the bore.
export function castFootPolygon({
  casingRadius, inset = 0.12, padHalfWidth, neckHalfWidth, footY, padHeight = 0.16, count = 24,
}) {
  const padTop = footY + padHeight;
  const arcRadius = casingRadius - inset;
  const neckY = -Math.sqrt(arcRadius ** 2 - neckHalfWidth ** 2);
  const points = [[-padHalfWidth, footY], [padHalfWidth, footY], [padHalfWidth, padTop]];
  const flank = (side, t) => [
    side * (padHalfWidth - (padHalfWidth - neckHalfWidth) * Math.sin(t * Math.PI / 2)),
    neckY - (neckY - padTop) * Math.cos(t * Math.PI / 2),
  ];
  for (let i = 1; i <= count; i += 1) points.push(flank(1, i / count));
  const start = Math.atan2(neckY, neckHalfWidth);
  const end = Math.atan2(neckY, -neckHalfWidth);
  // Clockwise from the right neck, under the bottom, to the left neck.
  for (let i = 1; i < count * 2; i += 1) {
    const angle = start + (end - start) * i / (count * 2);
    points.push([arcRadius * Math.cos(angle), arcRadius * Math.sin(angle)]);
  }
  for (let i = count; i >= 1; i -= 1) points.push(flank(-1, i / count));
  points.push([-padHalfWidth, padTop]);
  return poly(points);
}

export function castFootGeometry(options, low, high) {
  return plate(castFootPolygon(options), low, high);
}

// Concave fillets blending a round casing of radius R into a straight port
// neck whose faces lie at y=±halfHeight on the side `side` (±1).
export function portNeckFillets(casingRadius, halfHeight, side, filletRadius = 0.45, count = 24) {
  const polygons = [];
  for (const vertical of [-1, 1]) {
    const cy = halfHeight + filletRadius;
    const cx = Math.sqrt((casingRadius + filletRadius) ** 2 - cy ** 2);
    const tangentOnCasing = [cx * casingRadius / (casingRadius + filletRadius), cy * casingRadius / (casingRadius + filletRadius)];
    const a0 = Math.atan2(tangentOnCasing[1] - cy, tangentOnCasing[0] - cx);
    const a1 = -Math.PI / 2;
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      const angle = a0 + (a1 - a0) * i / count;
      points.push([cx + filletRadius * Math.cos(angle), cy + filletRadius * Math.sin(angle)]);
    }
    points.push([tangentOnCasing[0] - 0.08, halfHeight]);
    polygons.push(...poly(points.map(([x, y]) => [side * x, vertical * y])));
  }
  return polygons;
}

export {polygonClipping};
