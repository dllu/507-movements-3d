import { makeSingleToothStarSolid } from './single-tooth-star-solid.mjs';

// The same two-sided geometric constraint used by the accepted clearance
// study: finite driver boundary points and all sharp output corners.
export function makeSingleToothConstraintField(profile) {
  const p = profile.parameters, driver = profile.driver[0];
  const input = makeSingleToothStarSolid(driver);
  const slots = [], locks = [], corners = [];
  const half = p.pitch / 2, distance = p.centerDistance;
  const alpha = Math.acos((distance ** 2 + p.outputRadius ** 2
    - (p.driverRadius + p.clearance) ** 2) / (2 * distance * p.outputRadius));
  for (let i = 0; i < p.notches; i++) {
    const angle = Math.PI + i * p.pitch;
    slots.push([Math.cos(angle), Math.sin(angle)]);
    locks.push([distance * Math.cos(angle + half), distance * Math.sin(angle + half)]);
    for (const sign of [-1, 1]) {
      const a = angle + half + sign * alpha;
      corners.push([p.outputRadius * Math.cos(a), p.outputRadius * Math.sin(a)]);
      const x = Math.sqrt(p.outputRadius ** 2 - p.slotRadius ** 2), y = sign * p.slotRadius;
      corners.push([x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]);
    }
  }
  const outputPenetration = (point, q) => {
    const x = point[0] * Math.cos(q) + point[1] * Math.sin(q);
    const y = -point[0] * Math.sin(q) + point[1] * Math.cos(q);
    let depth = p.outputRadius - Math.hypot(x, y);
    if (depth <= 0) return depth;
    for (let i = 0; i < p.notches; i++) {
      const [cx, cy] = locks[i];
      depth = Math.min(depth, Math.hypot(x - cx, y - cy) - p.driverRadius - p.clearance);
      if (depth <= 0) return depth;
      const [ux, uy] = slots[i], along = x * ux + y * uy, across = -x * uy + y * ux;
      depth = Math.min(depth, Math.hypot(Math.max(0, p.slotCenter - along), across) - p.slotRadius);
      if (depth <= 0) return depth;
    }
    return depth;
  };
  const atAngle = angle => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const active = driver.map(([x, y]) => [x * c - y * s - distance, x * s + y * c])
      .filter(v => Math.hypot(...v) < p.outputRadius + 1e-5);
    return q => {
      let worst = active.reduce((maximum, v) => Math.max(maximum, outputPenetration(v, q)), 0);
      for (const [x, y] of corners) {
        const wx = distance + x * Math.cos(q) - y * Math.sin(q), wy = x * Math.sin(q) + y * Math.cos(q);
        worst = Math.max(worst, input.penetration([wx * c + wy * s, -wx * s + wy * c]));
      }
      return worst;
    };
  };
  return { atAngle };
}
