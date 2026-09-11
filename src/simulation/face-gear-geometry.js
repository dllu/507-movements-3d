import * as THREE from 'three';
import { crownCut } from '../data/contact-profiles.js';

const cache = new Map();

/** Sample the material left by a rotating involute shaper on a crown blank.
 *
 * The cutter is the pinion's actual polygon, without its axial chamfer. At
 * each radius/angle on the crown, its swept rightmost X is the face height.
 * This includes the change of transverse pitch across the face width; a
 * radial extrusion of a rack tooth does not. The small cutting clearance
 * covers interpolation and finite rotation steps, rather than separating
 * the pitch surfaces. This is a sampled generating process, not a stress or
 * manufacturing model. See NASA/CR-2000-209909 for face-gear generation.
 */
export function crownToothGeometry({
  profile,
  pinionTeeth,
  pinionCenterX,
  crownTeeth,
  innerRadius,
  outerRadius,
  baseFace,
  tipFace,
}, { regenerate = false } = {}) {
  const key = JSON.stringify({ profile, pinionTeeth, pinionCenterX, crownTeeth,
    innerRadius, outerRadius, baseFace, tipFace });
  if (!regenerate && cache.has(key)) return cache.get(key).clone();
  const radialSteps = 24;
  const angularSteps = 192;
  const rotationSteps = 1200;
  const cuttingClearance = 0.0007;
  const pitch = 2 * Math.PI / crownTeeth;
  const baked = !regenerate && crownCut?.key === key ? crownCut.heights : null;
  const heights = baked ? Float64Array.from(baked) : new Float64Array((radialSteps + 1) * (angularSteps + 1)).fill(tipFace);
  if (!baked) {
    // Outside this range the shaper's addendum circle is behind the blank tip.
    const shaperRadius = Math.max(...profile.map((p) => Math.hypot(p.x, p.y)));
    const sweep = Math.asin(Math.sqrt(shaperRadius ** 2 - (tipFace - pinionCenterX) ** 2) / innerRadius)
      + pitch / 2;
    for (let step = 0; step <= rotationSteps; step += 1) {
      const rotation = -sweep + 2 * sweep * step / rotationSteps;
      const pinionAngle = Math.PI / pinionTeeth - crownTeeth / pinionTeeth * rotation;
      const cosine = Math.cos(pinionAngle);
      const sine = Math.sin(pinionAngle);
      const points = profile.map((p) => ({ x: p.x * cosine - p.y * sine, y: p.x * sine + p.y * cosine }));
      const edges = [];
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        if (Math.max(a.x, b.x) + pinionCenterX < tipFace - cuttingClearance || Math.abs(a.y - b.y) < 1e-12) continue;
        edges.push({ x: a.x, y: a.y, low: Math.min(a.y, b.y), high: Math.max(a.y, b.y), slope: (b.x - a.x) / (b.y - a.y) });
      }
      for (let angular = 0; angular <= angularSteps; angular += 1) {
        const angle = -pitch / 2 + pitch * angular / angularSteps;
        const transverse = -Math.sin(angle + rotation);
        for (let radial = 0; radial <= radialSteps; radial += 1) {
          const radius = innerRadius + (outerRadius - innerRadius) * radial / radialSteps;
          const y = radius * transverse;
          const index = radial * (angularSteps + 1) + angular;
          for (const edge of edges) {
            if (y < edge.low || y > edge.high) continue;
            heights[index] = Math.max(heights[index], pinionCenterX + edge.x + (y - edge.y) * edge.slope + cuttingClearance);
          }
        }
      }
    }
    // Take the higher neighboring cuts before triangulation. Without this
    // conservative resampling, an interpolated triangle bridges the shaper's
    // curved tip sweep and puts material back into the mating pinion. The
    // resulting small backlash is checked against the rendered meshes.
    const sampledHeights = heights.slice();
    for (let radial = 0; radial <= radialSteps; radial += 1) {
      for (let angular = 0; angular <= angularSteps; angular += 1) {
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let da = -1; da <= 1; da += 1) {
            const r = THREE.MathUtils.clamp(radial + dr, 0, radialSteps);
            const a = THREE.MathUtils.euclideanModulo(angular + da, angularSteps);
            heights[radial * (angularSteps + 1) + angular] = Math.max(heights[radial * (angularSteps + 1) + angular], sampledHeights[r * (angularSteps + 1) + a]);
          }
        }
      }
    }
  }
  const positions = [];
  const indices = [];
  const stride = angularSteps + 1;
  const surfaceCount = heights.length;
  for (let layer = 0; layer < 2; layer += 1) {
    for (let radial = 0; radial <= radialSteps; radial += 1) {
      const radius = innerRadius + (outerRadius - innerRadius) * radial / radialSteps;
      for (let angular = 0; angular <= angularSteps; angular += 1) {
        const angle = -pitch / 2 + pitch * angular / angularSteps;
        const height = heights[radial * stride + angular];
        if (height >= baseFace) throw new RangeError('The face-gear cutter enters the backing disk.');
        positions.push(radius * Math.cos(angle), radius * Math.sin(angle), layer === 0 ? height : baseFace);
      }
    }
  }
  const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
  for (let radial = 0; radial < radialSteps; radial += 1) {
    for (let angular = 0; angular < angularSteps; angular += 1) {
      const a = radial * stride + angular;
      quad(a, a + 1, a + stride + 1, a + stride);

    }
    for (const angular of [0, angularSteps]) {
      const a = radial * stride + angular;
      if (angular === 0) quad(a, a + stride, a + stride + surfaceCount, a + surfaceCount);
      else quad(a, a + surfaceCount, a + stride + surfaceCount, a + stride);
    }
  }
  for (let angular = 0; angular < angularSteps; angular += 1) {
    const bottom = surfaceCount + angular;
    quad(bottom, bottom + radialSteps * stride, bottom + radialSteps * stride + 1, bottom + 1);
    quad(angular, angular + surfaceCount, angular + surfaceCount + 1, angular + 1);
    const a = radialSteps * stride + angular;
    quad(a, a + 1, a + surfaceCount + 1, a + surfaceCount);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = { profileKey: key, cuttingClearance, radialSteps, angularSteps, rotationSteps,
    innerRadius, outerRadius, pitch, heights: Array.from(heights), surfaceCount };
  cache.set(key, geometry);
  return geometry.clone();
}
