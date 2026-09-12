import assert from 'node:assert/strict';

// Outward padding is far larger than roundoff in these small world-unit
// calculations. These intervals cover the entire prescribed treadle stroke.
const pad = 1e-12, interval = (lo, hi = lo) => [lo - pad, hi + pad];
const add = (a, b) => interval(a[0] + b[0], a[1] + b[1]);
const negate = a => interval(-a[1], -a[0]);
const subtract = (a, b) => add(a, negate(b));
const multiply = (a, b) => {
  const v = a.flatMap(x => b.map(y => x * y)); return interval(Math.min(...v), Math.max(...v));
};
const scalar = (a, x) => multiply(a, [x, x]);
const square = a => interval(a[0] <= 0 && a[1] >= 0 ? 0 : Math.min(a[0] ** 2, a[1] ** 2), Math.max(a[0] ** 2, a[1] ** 2));
const absoluteMaximum = a => Math.max(Math.abs(a[0]), Math.abs(a[1]));
const sine = a => {
  const v = a.map(Math.sin);
  for (let k = Math.ceil((a[0] - Math.PI / 2) / Math.PI); Math.PI / 2 + k * Math.PI <= a[1]; k++) v.push(k % 2 ? -1 : 1);
  return interval(Math.min(...v), Math.max(...v));
};
const rotated = (v, q) => {
  const s = sine(q), c = sine(add(q, [Math.PI / 2, Math.PI / 2]));
  return [subtract(scalar(c, v[0]), scalar(s, v[1])), add(scalar(s, v[0]), scalar(c, v[1]))];
};

export function makeTreadleRatchetInputBounds(linkage) {
  const p = linkage.parameters, front = [-p.amplitude, p.amplitude], rear = [-p.amplitude - .01, p.amplitude + .01];
  const f = rotated(p.strapLocal, front), r = rotated(p.strapLocal, rear);
  const frontLength = subtract([p.pulley[1] - p.fulcrum[1], p.pulley[1] - p.fulcrum[1]], f[1]);
  const rearLength = subtract([p.pulley[1] - p.fulcrum[1], p.pulley[1] - p.fulcrum[1]], r[1]);
  assert(Math.min(frontLength[0], rearLength[0]) > .075, 'Both complete strap legs must stay below the pulley tangents');
  const T = add(add(frontLength, rearLength), [Math.PI * p.radius, Math.PI * p.radius]), dx = subtract(r[0], f[0]);
  const Ff = add(negate(multiply(T, f[0])), multiply(dx, f[1]));
  const Fr = subtract(negate(multiply(T, r[0])), multiply(dx, r[1]));
  assert(Ff[1] < 0 && Fr[1] < 0, 'Strap length must decrease with either treadle angle throughout the rectangle');
  const length = (q, s) => {
    const end = angle => [p.strapLocal[0] * Math.cos(angle) - p.strapLocal[1] * Math.sin(angle),
      p.strapLocal[0] * Math.sin(angle) + p.strapLocal[1] * Math.cos(angle)];
    const a = end(q), b = end(s);
    return Math.hypot(2 * (p.pulley[1] - p.fulcrum[1]) - a[1] - b[1] + Math.PI * p.radius, b[0] - a[0]);
  };
  const lowerBracketMargin = length(front[1], rear[0]) - p.targetLength;
  const upperBracketMargin = p.targetLength - length(front[0], rear[1]);
  assert(Math.min(lowerBracketMargin, upperBracketMargin) > 1e-10, 'The rear root must remain strictly bracketed for every front angle');
  const treadleSpeed = [p.amplitude * 2 * Math.PI / p.period];
  treadleSpeed.push(absoluteMaximum(Ff) / Math.abs(Fr[1]) * treadleSpeed[0] + pad);
  const limbs = p.arms.map((a, i) => {
    const b = rotated(a.rodLocal, i ? rear : front), B = b.map((v, j) => add(v, [p.fulcrum[j], p.fulcrum[j]]));
    const dSquared = add(square(B[0]), square(B[1]));
    // Squared triangle area is a concave quadratic in d², so its minimum
    // over this interval is at an endpoint. It equals cross(A,B)².
    const areaSquared = d2 => a.armRodRadius ** 2 * d2 - (a.armRodRadius ** 2 + d2 - a.rodLength ** 2) ** 2 / 4;
    const minimumCross = Math.sqrt(Math.min(...dSquared.map(areaSquared)) - pad);
    assert(Number.isFinite(minimumCross) && minimumCross > 0, 'The rod linkage must avoid toggle positions throughout its stroke');
    const betaDerivative = a.rodLength * Math.hypot(...a.rodLocal) / minimumCross + pad;
    assert(betaDerivative * 2 * Math.max(...front.map(Math.abs), ...rear.map(Math.abs)) < Math.PI,
      'The continuous arm branch must remain within the source angle unwrap');
    const armSpeed = betaDerivative * treadleSpeed[i], topSpeed = a.armRodRadius * armSpeed;
    const bottomSpeed = Math.hypot(...a.rodLocal) * treadleSpeed[i];
    return {name: a.name, dSquared, minimumCross, betaDerivative, armSpeed, topSpeed, bottomSpeed,
      pawlPivotSpeed: Math.hypot(...a.pawlLocal) * armSpeed,
      rodAngularSpeed: (topSpeed + bottomSpeed) / a.rodLength + pad};
  });
  const legRates = [absoluteMaximum(f[0]) * treadleSpeed[0], absoluteMaximum(r[0]) * treadleSpeed[1]];
  const endXRates = [absoluteMaximum(f[1]) * treadleSpeed[0], absoluteMaximum(r[1]) * treadleSpeed[1]];
  const transverseRate = legRates[0] + legRates[1], dxRate = endXRates[0] + endXRates[1];
  const wrapXSpeed = endXRates[0] + dxRate + absoluteMaximum(dx) * (legRates[0] + transverseRate) / T[0] + pad;
  const strapPointSpeed = Math.max(wrapXSpeed, ...treadleSpeed.map(v => Math.hypot(...p.strapLocal) * v)) + pad;
  return {frontAngle: front, rearAngle: rear, frontLength, rearLength, T, dx, Ff, Fr,
    lowerBracketMargin, upperBracketMargin, treadleSpeed, limbs, wrapXSpeed, strapPointSpeed,
    pulleyAngularSpeed: transverseRate / (2 * p.radius) + pad,
    qualification: 'Intervals bound both treadle angles over the entire input cycle. Negative strap derivatives and strict endpoint brackets establish a unique rear angle throughout that rectangle. Triangle-area bounds exclude rod toggles and bound arm/rod speeds. Fixed-angle wrap samples have constant Y/Z and the stated X-speed bound; strap endpoints follow the treadles. Float32 strap vertex rounding must be added separately to any swept-surface bound.'};
}
