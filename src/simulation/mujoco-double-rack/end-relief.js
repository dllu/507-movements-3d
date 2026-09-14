// A construction envelope, never a runtime rack-position constraint. A short
// rounded reversal leaves clearance for the passive rack to coast and transfer.
// Away from the ends, the ordinary rack-generated involute is retained.
export function relieveSectorEnds(outline, {
  phase, sectorCenter, pitchRadius: radius, cutterPitchRadius, pitch, rackOrigin, upperOffset,
  bottom, corner, pressureAngle, rootRadius, reliefSteps, transitionAngle,
  reliefClearance,
}) {
  const tangent = Math.tan(pressureAngle), normalCenter = bottom + corner;
  const tangentCenter = pitch / 4 + (bottom - cutterPitchRadius) * tangent
    - corner * (1 / Math.cos(pressureAngle) - tangent);
  const tangentHeight = normalCenter - corner * Math.sin(pressureAngle);
  const offset = sectorCenter + Math.PI / 2;
  return outline.map(point => {
    const angle = Math.atan2(point.y, point.x) + phase;
    let limit = point.length();
    for (let step = 0; step <= reliefSteps; step++) {
      const theta = 2 * Math.PI * step / reliefSteps;
      const triangle = Math.asin(Math.sin(theta + offset));
      const endDistance = Math.PI / 2 - Math.abs(triangle);
      const travel = radius * (transitionAngle > 0 && endDistance < transitionAngle
        ? Math.sign(triangle) * (Math.PI / 2 - transitionAngle / 2
          - endDistance ** 2 / (2 * transitionAngle)) : triangle) - radius * offset;
      const ut = Math.cos(angle + theta);
      for (const rackSide of [-1, 1]) {
        const un = rackSide * Math.sin(angle + theta);
        if (un <= 0 || bottom / un >= limit) continue;
        for (let tooth = 0; tooth < 9; tooth++) {
          const center = travel + rackOrigin + tooth * pitch
            + (rackSide === 1 ? upperOffset : 0);
          let entry = bottom / un, exit = limit;
          for (const side of [-1, 1]) {
            const slope = side * ut - tangent * un;
            const bound = side * center + pitch / 4 - tangent * cutterPitchRadius;
            if (slope > 1e-12) exit = Math.min(exit, bound / slope);
            else if (slope < -1e-12) entry = Math.max(entry, bound / slope);
            else if (bound < 0) exit = -Infinity;
          }
          if (entry >= exit || entry <= 0) continue;
          const normal = entry * un, tangential = entry * ut - center;
          if (normal < tangentHeight && Math.abs(tangential) > tangentCenter) {
            const ct = center + Math.sign(tangential) * tangentCenter;
            const dot = un * normalCenter + ut * ct;
            const discriminant = dot ** 2 - (normalCenter ** 2 + ct ** 2 - corner ** 2);
            if (discriminant < 0) continue;
            entry = Math.max(entry, dot - Math.sqrt(discriminant));
          }
          if (entry < exit) limit = Math.min(limit, entry - reliefClearance);
        }
      }
    }
    return point.clone().setLength(Math.max(rootRadius, limit));
  });
}
