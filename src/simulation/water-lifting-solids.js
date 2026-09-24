import * as THREE from 'three';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { mergePassageParts } from './finite-fluid-passages.js';

// Finite, open-ended tapered channel. The footprint is also used to cut the hub ports.
export function curvedFloatChannel(curve, depth) {
  const strip = (inset, extend = 0) => {
    const left = [], right = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64, p = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
      if (i === 0) p.addScaledVector(tangent, -extend);
      if (i === 64) p.addScaledVector(tangent, extend);
      // Brown's floats are single heavy lines; the channel is only as wide as
      // its water passage needs.
      const width = THREE.MathUtils.lerp(.07, .095, t) - inset;
      left.push([p.x - tangent.y * width, p.y + tangent.x * width]);
      right.push([p.x + tangent.y * width, p.y - tangent.x * width]);
    }
    return poly([...left, ...right.reverse()]);
  };
  const outer = strip(0), port = strip(.03, .05);
  return {
    geometry: mergePassageParts([
      plate(outer, -depth / 2, -depth / 2 + .035),
      plate(polygonClipping.difference(outer, port), -depth / 2 + .035, depth / 2),
    ]),
    port,
  };
}

export function portedFloatHub(inner, outer, length, channelPort, count, depth) {
  let middle = polygonClipping.difference(poly(circle([0, 0], outer, 192)), poly(circle([0, 0], inner, 192)));
  for (let index = 0; index < count; index++) {
    const a = index * 2 * Math.PI / count, c = Math.cos(a), s = Math.sin(a);
    const port = channelPort.map(polygon => polygon.map(ring => ring.map(([x, y]) => [x*c-y*s, x*s+y*c])));
    middle = polygonClipping.difference(middle, port);
  }
  const annulus = polygonClipping.difference(poly(circle([0, 0], outer, 192)), poly(circle([0, 0], inner, 192)));
  return mergePassageParts([
    plate(annulus, -length/2, -depth/2),
    plate(middle, -depth/2, depth/2),
    plate(annulus, depth/2, length/2),
  ]);
}
