import { makeSingleToothStarSolid } from './single-tooth-star-solid.mjs';

// Both finite polygon boundaries are sampled, including every sharp tooth tip.
// Euclidean penetration is measured against the entire opposite polygon.
export function makeSmallSingleToothConstraintField(profile, parameters) {
  const input = makeSingleToothStarSolid(profile.driver[0]);
  const output = makeSingleToothStarSolid(profile.output[0]);
  const p = parameters, range = p.searchAdvance ?? 2 * p.pitch + 0.02;
  const wedge = Math.asin(input.maximumRadius / p.centerDistance) + 1e-8;
  const low = -wedge - p.initialQ, high = wedge - p.initialQ + range;
  const outputPoints = profile.output[0].filter(([x, y]) => {
    const a = Math.atan2(y, x); return a >= low && a <= high;
  });
  const atAngle = angle => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const active = profile.driver[0].map(([x, y]) => [p.centerDistance + x * c - y * s, x * s + y * c])
      .filter(([x, y]) => x * x + y * y <= output.maximumRadius ** 2 + 1e-10);
    return (advance, details = false) => {
      const q = p.initialQ - advance, cq = Math.cos(q), sq = Math.sin(q);
      let maximum = 0, witness = null;
      for (const [x, y] of active) {
        const point = [x * cq + y * sq, -x * sq + y * cq], value = output.penetration(point);
        if (value > maximum) { maximum = value; if (details) witness = { target: 'output', point }; }
      }
      for (const [x, y] of outputPoints) {
        const wx = x * cq - y * sq - p.centerDistance, wy = x * sq + y * cq;
        if (wx * wx + wy * wy > input.maximumRadius ** 2) continue;
        const point = [wx * c + wy * s, -wx * s + wy * c], value = input.penetration(point);
        if (value > maximum) { maximum = value; if (details) witness = { target: 'input', point }; }
      }
      return details ? { maximum, witness } : maximum;
    };
  };
  return { atAngle, inputVertices: profile.driver[0].length, outputVertices: profile.output[0].length,
    activeOutputVertices: outputPoints.length, lipschitzBound: output.maximumRadius };
}
