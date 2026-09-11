import * as THREE from 'three';

const cache = new Map();

/** Remove a rolling straight-flanked rack from a convex gear blank.
 * A common rack generates conjugate noncircular flanks, whereas rectangles
 * placed at equally spaced pitch points only reproduce tooth spacing.
 * See Bäsel, Determining the geometry of noncircular gears for given
 * transmission function, arXiv:1905.02642, for the generating principle.
 */
export function rackGeneratedOutline({ pitchPoints, teeth, contactPointIndex, toothAtContact }) {
  const key = JSON.stringify({ pitchPoints, teeth, contactPointIndex, toothAtContact });
  if (cache.has(key)) return cache.get(key);
  const count = pitchPoints.length;
  const lengths = [0];
  const tangents = pitchPoints.map((p, index) => {
    const before = pitchPoints[(index + count - 1) % count];
    const after = pitchPoints[(index + 1) % count];
    return after.clone().sub(before).normalize();
  });
  for (let index = 0; index < count; index += 1) {
    lengths.push(lengths.at(-1) + pitchPoints[index].distanceTo(pitchPoints[(index + 1) % count]));
  }
  const perimeter = lengths.at(-1);
  const pitch = perimeter / teeth;
  const module = pitch / Math.PI;
  const addendum = module;
  const dedendum = module * 1.25;
  const backlash = module * 0.01;
  const clearance = module * 0.002;
  const pressureTangent = Math.tan(Math.PI / 9);
  const rayCount = teeth * 128;
  const rays = Array.from({ length: rayCount }, (_, i) => ({
    x: Math.cos(i * 2 * Math.PI / rayCount), y: Math.sin(i * 2 * Math.PI / rayCount),
  }));
  const radii = new Float64Array(rayCount).fill(Infinity);
  const poses = [];
  for (let index = 0; index < count; index += 1) {
    for (let subdivision = 0; subdivision < 4; subdivision += 1) {
      const fraction = subdivision / 4;
      const next = (index + 1) % count;
      const point = pitchPoints[index].clone().lerp(pitchPoints[next], fraction);
      const tangent = tangents[index].clone().lerp(tangents[next], fraction).normalize();
      const normal = new THREE.Vector2(tangent.y, -tangent.x);
      const s = THREE.MathUtils.lerp(lengths[index], lengths[index + 1], fraction);
      poses.push({ point, tangent, normal, s, pn: point.dot(normal), pt: point.dot(tangent) });
    }
  }
  // Intersection of offset support half-planes gives a convex addendum
  // blank, including the rounded transitions between almost-flat sides.
  for (const { normal, pn } of poses) {
    for (let i = 0; i < rayCount; i += 1) {
      const dot = rays[i].x * normal.x + rays[i].y * normal.y;
      if (dot > 0) radii[i] = Math.min(radii[i], (pn + addendum) / dot);
    }
  }
  const referenceArc = lengths[contactPointIndex];
  const cutterPhase = toothAtContact ? 0.5 : 0;
  for (const { tangent, normal, s, pn, pt } of poses) {
    for (let i = 0; i < rayCount; i += 1) {
      const un = rays[i].x * normal.x + rays[i].y * normal.y;
      if (un <= 0) continue;
      const rootIntersection = (pn - dedendum) / un;
      if (rootIntersection >= radii[i]) continue;
      const ut = rays[i].x * tangent.x + rays[i].y * tangent.y;
      const lowX = Math.min(rootIntersection * ut, radii[i] * ut) - pt;
      const highX = Math.max(rootIntersection * ut, radii[i] * ut) - pt;
      const first = Math.floor((lowX + s - referenceArc) / pitch - cutterPhase) - 1;
      const last = Math.ceil((highX + s - referenceArc) / pitch - cutterPhase) + 1;
      for (let tooth = first; tooth <= last; tooth += 1) {
        const center = (tooth + cutterPhase) * pitch - s + referenceArc;
        let entry = rootIntersection;
        let exit = radii[i];
        // A rack tooth occupies y >= -dedendum and
        // |x-center| <= pitch/4 + backlash/2 + y*tan(pressure angle).
        for (const side of [-1, 1]) {
          const coefficient = side * ut - pressureTangent * un;
          const bound = side * (pt + center) + pitch / 4 + backlash / 2 - pressureTangent * pn;
          if (coefficient > 1e-12) exit = Math.min(exit, bound / coefficient);
          else if (coefficient < -1e-12) entry = Math.max(entry, bound / coefficient);
          else if (bound < 0) exit = -Infinity;
        }
        if (entry < exit && entry > 0) radii[i] = entry - clearance;
      }
    }
  }
  const points = rays.map((ray, i) => new THREE.Vector2(ray.x * radii[i], ray.y * radii[i]));
  const result = { points, perimeter, pitch, module, addendum, dedendum, backlash, clearance };
  cache.set(key, result);
  return result;
}
