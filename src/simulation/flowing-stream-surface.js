import * as THREE from 'three';
import { WaterStream, guidedPath, waterStreamMaterial } from './water-stream.js';

// The visible current of a stream or river whose water body is a static
// translucent volume (441, 442, 443, 447): one flat streaked WaterStream
// sheet lying just under the volume's free surface, running from `start` to
// `end` (points on the surface, upstream to downstream) at the stream's
// speed. The streaks scroll with the water (see water-stream.js: they move
// at the path speed whatever the streak rate), and the scroll rate is
// rounded so the loop is seamless over `cyclePeriod`. The section is an
// ellipse (half-width `halfWidth`, half-thickness `thickness`) centred
// `depth` below the surface, so its edges never lie on the volume's walls
// and its top never shares the volume's top face. A thin sheet reads from
// above (447's plan view); a deep body filling the upper stream shows its
// streaks through the volume's side face in an elevation view (441).
export function flowingStreamSurface({
  start,
  end,
  halfWidth,
  speed,
  cyclePeriod,
  depth = 0.05,
  thickness = 0.018,
  streakLength = 2.4,
  streakAcross = null,
  opacity = 0.42,
  normalScale = 0.3,
  fade = 0.06,
  samples = 24,
  role = 'flowing-stream-surface-current',
}) {
  const down = new THREE.Vector3(0, -depth, 0);
  const path = guidedPath([start.clone().add(down), end.clone().add(down)], {speed, samples});
  const sheet = new WaterStream(path, {
    width: halfWidth,
    thickness,
    widthAxis: 'horizontal',
    widthExponent: 0,
    fadeIn: fade,
    fadeOut: fade,
    radialSegments: 16,
    cyclePeriod,
    streakRate: speed / streakLength,
    streakAcross: streakAcross ?? Math.max(2, Math.round(1.2 * (halfWidth + thickness))),
    material: waterStreamMaterial({opacity, normalScale}),
    minThickness: thickness,
  });
  sheet.userData.role = role;
  return sheet;
}
