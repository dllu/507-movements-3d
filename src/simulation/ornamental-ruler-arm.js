import { circle, poly, plate, polygonClipping as clip } from './finite-plate-geometry.js';
import { rulerArmProfiles } from './ruler-arm-profiles.js';

// The extracted silhouette supplies only the ornamental outline; joint centers,
// round eyes and through-holes remain exact mechanical geometry.
export function ornamentalRulerArmGeometry(id, length, depth, startRadius, endRadius = startRadius) {
  const points = rulerArmProfiles[id].points.map(([x, y]) => [x * length, y * length]);
  const outline = clip.union(poly(points), poly(circle([0, 0], startRadius + .04, 64)),
    poly(circle([length, 0], endRadius + .04, 64)));
  return plate(clip.difference(outline, poly(circle([0, 0], startRadius, 64)),
    poly(circle([length, 0], endRadius, 64))), -depth / 2, depth / 2);
}
