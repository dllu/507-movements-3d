// Monotone cubic interpolation of the independently solved forward contact
// branch. The cycle cut lies within a dwell. Angle is retained after release;
// ideal bearing friction supplies the dwell assumption, not a positive lock.
export function makeMutilatedBevelContactSpline(nodes) {
  if (nodes.length < 3 || nodes[0][0] !== 0 || nodes.at(-1)[0] !== 1) {
    throw new Error('Contact knots must span one input turn');
  }
  const widths = [], secants = [], slopes = Array(nodes.length).fill(0);
  for (let i = 0; i + 1 < nodes.length; i++) {
    const h = nodes[i + 1][0] - nodes[i][0];
    const d = (nodes[i + 1][1] - nodes[i][1]) / h;
    if (h <= 0 || d < -1e-7) throw new Error('Contact knots must increase in input and output angle');
    widths.push(h);
    secants.push(Math.max(0, d));
  }
  for (let i = 1; i + 1 < nodes.length; i++) {
    const a = secants[i - 1], b = secants[i], h0 = widths[i - 1], h1 = widths[i];
    if (a * b > 0) {
      const first = 2 * h1 + h0, last = h1 + 2 * h0;
      slopes[i] = (first + last) / (first / a + last / b);
    }
  }
  const intervals = widths.map((h, i) => {
    const first = nodes[i][1], last = nodes[i + 1][1];
    const m0 = h * slopes[i], m1 = h * slopes[i + 1];
    return { start: nodes[i][0], width: h,
      a: 2 * first - 2 * last + m0 + m1, b: -3 * first + 3 * last - 2 * m0 - m1,
      c: m0, d: first };
  });
  const at = x => {
    let low = 0, high = nodes.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (nodes[mid][0] <= x) low = mid;
      else high = mid;
    }
    const s = intervals[low], t = (x - s.start) / s.width;
    return { angle: ((s.a * t + s.b) * t + s.c) * t + s.d,
      derivative: (3 * s.a * t * t + 2 * s.b * t + s.c) / s.width,
      secondDerivative: (6 * s.a * t + 2 * s.b) / (s.width * s.width), interval: low };
  };
  return { at, intervals, nodes };
}

export function makeMutilatedBevelSplineMotion(profile) {
  const spline = makeMutilatedBevelContactSpline(profile.nodes);
  const atCoordinate = coordinate => {
    const relative = coordinate - profile.base, cycle = Math.floor(relative), local = relative - cycle;
    const state = spline.at(local);
    return { ...state, angle: state.angle + cycle * profile.advance, coordinate, cycle, local };
  };
  return { atCoordinate, spline };
}
