import { starMangleMotion } from './star-mangle-motion.js';

const modulo = (x, period) => ((x % period) + period) % period;
function limitedSlope(h0, h1, d0, d1) {
  if (d0 * d1 <= 0) return 0;
  const a = 2 * h1 + h0, b = h1 + 2 * h0;
  return (a + b) / (a / d0 + b / d1);
}

// Interpolate the first-contact phase correction, not a desired wheel speed.
// Periodic PCHIP slopes avoid overshoot at local extrema. Independent bake
// samples still have to bound the interpolation error against actual skins.
export function starMangleContactSpline(nodes) {
  const n = nodes.length, period = nodes.at(-1)[0];
  if (n < 3 || nodes[0][0] !== 0 || period <= 0) throw new RangeError('A contact map must cover a complete cycle.');
  const widths = [], secants = [], slopes = [];
  for (let i = 0; i + 1 < n; i += 1) {
    const width = nodes[i + 1][0] - nodes[i][0]; if (width <= 0) throw new RangeError('Contact stations must increase.');
    widths.push(width); secants.push((nodes[i + 1][1] - nodes[i][1]) / width);
  }
  slopes[0] = slopes[n - 1] = limitedSlope(widths.at(-1), widths[0], secants.at(-1), secants[0]);
  for (let i = 1; i + 1 < n; i += 1) slopes[i] = limitedSlope(widths[i - 1], widths[i], secants[i - 1], secants[i]);
  const intervals = widths.map((width, i) => {
    const y0 = nodes[i][1], y1 = nodes[i + 1][1], m0 = width * slopes[i], m1 = width * slopes[i + 1];
    return { start: nodes[i][0], width, a: 2 * y0 - 2 * y1 + m0 + m1,
      b: -3 * y0 + 3 * y1 - 2 * m0 - m1, c: m0, d: y0 };
  });
  const evaluateInterval = (i, pathTravel) => {
    const { start, width, a, b, c, d } = intervals[i], u = (pathTravel - start) / width;
    return { advance: ((a * u + b) * u + c) * u + d,
      derivative: (3 * a * u * u + 2 * b * u + c) / width,
      secondDerivative: (6 * a * u + 2 * b) / (width * width), interval: i };
  };
  const at = (pathTravel) => {
    const x = modulo(pathTravel, period); let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const middle = (lo + hi) >> 1; if (nodes[middle][0] <= x) lo = middle; else hi = middle; }
    return evaluateInterval(lo, x);
  };
  let minimumInputDerivative = Infinity, maximumInputDerivative = -Infinity;
  for (const [i, s] of intervals.entries()) {
    const candidates = [0, 1]; if (s.a !== 0 && -s.b / (3 * s.a) > 0 && -s.b / (3 * s.a) < 1) candidates.push(-s.b / (3 * s.a));
    for (const t of candidates) {
      const value = 1 + evaluateInterval(i, s.start + t * s.width).derivative;
      minimumInputDerivative = Math.min(minimumInputDerivative, value); maximumInputDerivative = Math.max(maximumInputDerivative, value);
    }
  }
  return { at, evaluateInterval, intervals, nodes, period, minimumInputDerivative, maximumInputDerivative };
}

export function starMangleLoadedMotion(map) {
  const path = starMangleMotion(map.parameters), p = path.parameters;
  const spline = starMangleContactSpline(map.nodes), backoff = map.phaseBackoff;
  if (Math.abs(spline.period - p.cycleTravel) > 1e-9 || spline.minimumInputDerivative <= 0) throw new RangeError('The loaded contact map must have a strictly increasing input phase.');
  const inputStations = map.nodes.map(([x, y]) => x + y - backoff), initialInput = inputStations[0];
  function atInputTravel(inputTravel) {
    const cycles = Math.floor((inputTravel - initialInput) / p.cycleTravel), input = inputTravel - cycles * p.cycleTravel;
    let lo = 0, hi = inputStations.length - 1;
    while (hi - lo > 1) { const middle = (lo + hi) >> 1; if (inputStations[middle] <= input) lo = middle; else hi = middle; }
    const interval = lo, lower = map.nodes[lo][0], upper = map.nodes[hi][0];
    let x = lower + (upper - lower) * (input - inputStations[lo]) / (inputStations[hi] - inputStations[lo]);
    for (let i = 0; i < 8; i += 1) {
      const s = spline.evaluateInterval(interval, x), residual = x + s.advance - backoff - input;
      x = Math.max(lower, Math.min(upper, x - residual / (1 + s.derivative)));
    }
    const contact = spline.evaluateInterval(interval, x), pathTravel = x + cycles * p.cycleTravel;
    const state = path.atTravel(pathTravel), inputDerivative = 1 + contact.derivative;
    const pathSpeed = p.inputSpeed / inputDerivative, pathAcceleration = -contact.secondDerivative * p.inputSpeed ** 2 / inputDerivative ** 3;
    return { ...state, pathTravel, inputTravel, phaseAdvance: contact.advance - backoff,
      contactInterval: interval, inputDerivative, pathSpeed, pathAcceleration,
      pinionAngle: p.pinionPhase + inputTravel, pinionAngularSpeed: p.inputSpeed,
      wheelAngularSpeed: state.wheelDerivative * pathSpeed,
      wheelAngularAcceleration: state.wheelSecondDerivative * pathSpeed * pathSpeed + state.wheelDerivative * pathAcceleration,
      centerVelocityY: state.centerDY * pathSpeed, centerVelocityZ: state.centerDZ * pathSpeed,
      centerAccelerationY: state.centerDDY * pathSpeed * pathSpeed + state.centerDY * pathAcceleration,
      centerAccelerationZ: state.centerDDZ * pathSpeed * pathSpeed + state.centerDZ * pathAcceleration };
  }
  return { parameters: { ...p, phaseBackoff: backoff, minimumInputDerivative: spline.minimumInputDerivative,
    maximumInputDerivative: spline.maximumInputDerivative }, spline, atInputTravel,
    inputAtPath: (travel) => travel + spline.at(travel).advance - backoff,
    atTime: (time) => atInputTravel(initialInput + p.inputSpeed * time) };
}
