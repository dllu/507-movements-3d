// Independent readings from the public-domain Brown 069 enlargement.
// The source drawing supplies these profiles; mechanical acceptance is separate.
export const smallSingleToothSource = {
  driverCenter: [907.9121179788857, 622.6410764960106],
  outputCenter: [498.1903616733449, 827.0625984238025],
  driverPixelRadius: 94.92361409071245,
  driverRadius: 0.7,
  centerlineAngle: 26.51587818969324 * Math.PI / 180,
  toothReadings: [[956,549],[954,587],[1036,550],[1046,570],[970,623],[997,652]],
  section: [[0,358.25],[.04,356.0625],[.08,353.625],[.12,351.25],
    [.16,348.8125],[.2,346.125],[.25,343.125],[.3,340.3125],
    [.4,333.375],[.5,326.625],[.6,321.4375],[.7,322.75],
    [.8,331.5],[.9,351.25],[1,358.25]],
};

// Shape-preserving cubic interpolation retains the measured minimum and the
// sharp tooth tip without ringing between the radial source readings.
function sectionInterpolator(points) {
  const h = points.slice(1).map((p, i) => p[0] - points[i][0]);
  const slope = h.map((v, i) => (points[i + 1][1] - points[i][1]) / v);
  const derivative = points.map((p, i) => {
    if (i === 0) return slope[0];
    if (i === points.length - 1) return slope.at(-1);
    if (slope[i - 1] * slope[i] <= 0) return 0;
    const a = 2 * h[i] + h[i - 1], b = h[i] + 2 * h[i - 1];
    return (a + b) / (a / slope[i - 1] + b / slope[i]);
  });
  return x => {
    let i = 0; while (i < points.length - 2 && points[i + 1][0] < x) i++;
    const t = (x - points[i][0]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * points[i][1]
      + (t3 - 2 * t2 + t) * h[i] * derivative[i]
      + (-2 * t3 + 3 * t2) * points[i + 1][1]
      + (t3 - t2) * h[i] * derivative[i + 1];
  };
}

export function makeSmallSingleToothSourceProfiles({ circleSteps = 2048, curveSteps = 48, toothSteps = 128, toothShortening = 0, rootDeepening = 0 } = {}) {
  const source = smallSingleToothSource, turn = 2 * Math.PI, teeth = 30, pitch = turn / teeth;
  const scale = source.driverPixelRadius / source.driverRadius;
  const c = Math.cos(source.centerlineAngle), s = Math.sin(source.centerlineAngle);
  const local = point => {
    const x = (point[0] - source.driverCenter[0]) / scale;
    const y = (source.driverCenter[1] - point[1]) / scale;
    return [x * c + y * s - (point[0] > 1020 ? toothShortening : 0), -x * s + y * c];
  };
  const rim = point => { const p = local(point), r = Math.hypot(...p); return p.map(v => v * source.driverRadius / r); };
  const lower = rim([997,652]), upper = rim([956,549]), driver = [lower];
  const cubic = (a, b, d, end) => {
    for (let i = 1; i <= curveSteps; i++) {
      const t = i / curveSteps, v = 1 - t;
      driver.push(a.map((q, k) => v ** 3 * q + 3 * v ** 2 * t * b[k] + 3 * v * t ** 2 * d[k] + t ** 3 * end[k]));
    }
  };
  const line = end => {
    const start = driver.at(-1);
    for (let i = 1; i <= curveSteps; i++) driver.push(start.map((v, k) => v + (end[k] - v) * i / curveSteps));
  };
  cubic(lower, local([989,640]), local([970,627]), local([970,623]));
  line(local([1046,570]));
  cubic(driver.at(-1), local([1045,564]), local([1040,555]), local([1036,550]));
  line(local([954,587]));
  cubic(driver.at(-1), local([955,573]), local([958,558]), upper);
  const start = Math.atan2(upper[1], upper[0]), end = Math.atan2(lower[1], lower[0]) + turn;
  const steps = Math.ceil(circleSteps * (end - start) / turn);
  for (let i = 1; i < steps; i++) {
    const angle = start + (end - start) * i / steps;
    driver.push([source.driverRadius * Math.cos(angle), source.driverRadius * Math.sin(angle)]);
  }
  const section = sectionInterpolator(source.section), output = [];
  for (let tooth = 0; tooth < teeth; tooth++) for (let i = 0; i < toothSteps; i++) {
    const fraction = i / toothSteps, angle = (tooth + fraction) * pitch;
    const radius = section(fraction) / scale - rootDeepening * Math.sin(Math.PI * fraction) ** 2;
    output.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return { driver: [driver], output: [output], parameters: {
    teeth, pitch, toothShortening, rootDeepening, driverRadius: source.driverRadius, outputRadius: section(0) / scale,
    sourceCenterDistance: Math.hypot(source.driverCenter[0] - source.outputCenter[0], source.driverCenter[1] - source.outputCenter[1]) / scale,
    centerlineAngle: source.centerlineAngle, sourceScale: scale, depth: 0.24,
  } };
}
