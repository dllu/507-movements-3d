import * as THREE from 'three';

// Rack generation with tangent circular cutter tips.
// The tool rounds away its sharp lower corners, preserving the working
// involute that a full-depth, square-ended cutter needlessly undercuts.
const outlineCache = new Map();
export function roundedRackGear({ teeth, module, depth, boreRadius,
  samples = 512, cutterSteps = 8192, backlash = module * 0.008,
  radialClearance = module * 0.0002, pressureAngle = Math.PI / 9,
  addendum = 1, dedendum = 1.25,
  tipRadius = module * Math.min(0.38, 0.95 * (Math.PI / 4 - dedendum * Math.tan(pressureAngle))
    / (1 / Math.cos(pressureAngle) - Math.tan(pressureAngle))) }) {
  const radius = teeth * module / 2, pitch = Math.PI * module;
  const cacheKey = [teeth, module, samples, cutterSteps, backlash, radialClearance, pressureAngle, tipRadius, addendum, dedendum].join(',');
  let outline = outlineCache.get(cacheKey);
  const tangent = Math.tan(pressureAngle);
  const bottom = radius - dedendum * module, circleN = bottom + tipRadius;
  const bottomHalf = pitch / 4 + backlash / 2 - dedendum * module * tangent;
  const circleT = bottomHalf - tipRadius * (1 / Math.cos(pressureAngle) - tangent);
  const tangentN = circleN - tipRadius * Math.sin(pressureAngle);
  if (circleT <= 0) throw new RangeError('Cutter tips overlap');
  if (!outline) {
    const tooth = [];
    for (let sample = 0; sample < samples; sample += 1) {
      const angle = (sample / samples - 0.5) * 2 * Math.PI / teeth;
      let limit = radius + addendum * module;
      for (let step = 0; step <= cutterSteps; step += 1) {
        const cutterAngle = angle - 0.8 + 1.6 * step / cutterSteps;
        const un = Math.cos(angle - cutterAngle), ut = Math.sin(angle - cutterAngle);
        const root = bottom / un;
        if (root >= limit) continue;
        const travel = radius * cutterAngle;
        const first = Math.floor((Math.min(root * ut, limit * ut) + travel) / pitch - 0.5) - 1;
        const last = Math.ceil((Math.max(root * ut, limit * ut) + travel) / pitch - 0.5) + 1;
        for (let index = first; index <= last; index += 1) {
          const center = (index + 0.5) * pitch - travel;
          let entry = root, exit = limit;
          for (const side of [-1, 1]) {
            const slope = side * ut - tangent * un;
            const bound = side * center + pitch / 4 + backlash / 2 - tangent * radius;
            if (slope > 1e-12) exit = Math.min(exit, bound / slope);
            else if (slope < -1e-12) entry = Math.max(entry, bound / slope);
            else if (bound < 0) exit = -Infinity;
          }
          if (entry >= exit || entry <= 0) continue;
          const n = entry * un, t = entry * ut - center;
          if (n < tangentN && Math.abs(t) > circleT) {
            const ct = center + Math.sign(t) * circleT;
            const dot = un * circleN + ut * ct;
            const discriminant = dot * dot - (circleN ** 2 + ct ** 2 - tipRadius ** 2);
            // A ray arriving through a removed corner first enters its
            // tangent circle; the upper straight flank remains unchanged.
            if (discriminant < 0) continue;
            entry = Math.max(entry, dot - Math.sqrt(discriminant));
          }
          if (entry < exit) limit = Math.min(limit, entry);
        }
      }
      tooth.push({ angle, radius: limit - radialClearance });
    }
    outline = Array.from({ length: teeth }, (_, i) => tooth.map(p => new THREE.Vector2(
      p.radius * Math.cos(p.angle + i * 2 * Math.PI / teeth),
      p.radius * Math.sin(p.angle + i * 2 * Math.PI / teeth)))).flat();
    outlineCache.set(cacheKey, outline);
  }
  const shape = new THREE.Shape(outline), hole = new THREE.Path();
  hole.absarc(0, 0, boreRadius, 0, 2 * Math.PI, true); shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 }).translate(0, 0, -depth / 2);
  geometry.userData = { teeth, module, pitchRadius: radius, outerRadius: radius + addendum * module - radialClearance,
    rootRadius: bottom - radialClearance, boreRadius, depth, outline, pressureAngle,
    cutterTipRadius: tipRadius, backlash, radialClearance, samples, cutterSteps, addendum, dedendum,
    toothProfile: 'rounded-rack-generated-involute-with-root-transition' };
  return geometry;
}
