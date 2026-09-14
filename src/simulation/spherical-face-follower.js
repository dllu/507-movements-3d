// Axial envelope of a spherical tip on a radially extruded periodic face cam.
// The radial minimizer r = contactRadius*cos(delta) remains inside the rim.
export function sphericalFaceFollower(profile, angle, contactRadius, tipRadius) {
  const limit = Math.asin(tipRadius / contactRadius) * (1 - 1e-10);
  const evaluate = delta => {
    const p = profile(angle + delta);
    const s = Math.sin(delta), c = Math.cos(delta);
    const q = Math.sqrt(Math.max(0, tipRadius ** 2 - contactRadius ** 2 * s ** 2));
    return {value: p.faceCoordinate + q, p, q, s, c, delta};
  };
  let best = 0, bestValue = -Infinity;
  const samples = 64;
  for (let i = 0; i <= samples; i++) {
    const delta = -limit + 2 * limit * i / samples;
    const value = evaluate(delta).value;
    if (value > bestValue) { bestValue = value; best = i; }
  }
  let lo = -limit + 2 * limit * Math.max(0, best - 1) / samples;
  let hi = -limit + 2 * limit * Math.min(samples, best + 1) / samples;
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = hi - ratio * (hi - lo), b = lo + ratio * (hi - lo);
  let fa = evaluate(a).value, fb = evaluate(b).value;
  for (let i = 0; i < 48; i++) {
    if (fa > fb) { hi = b; b = a; fb = fa; a = hi - ratio * (hi - lo); fa = evaluate(a).value; }
    else { lo = a; a = b; fa = fb; b = lo + ratio * (hi - lo); fb = evaluate(b).value; }
  }
  let delta = (lo + hi) / 2;
  for (let i = 0; i < 4; i++) {
    const v = evaluate(delta);
    const first = v.p.liftDerivativeByAngle - contactRadius ** 2 * v.s * v.c / v.q;
    const second = v.p.liftSecondDerivativeByAngle - contactRadius ** 2 * (v.c*v.c-v.s*v.s) / v.q
      - contactRadius ** 4 * v.s*v.s*v.c*v.c / v.q**3;
    if (!(second < 0)) break;
    const next = delta - first / second;
    if (Math.abs(next) >= limit) break;
    delta = next;
  }
  const result = evaluate(delta);
  const {p, q, s, c} = result;
  const hSecond = -(contactRadius ** 2) * (c*c-s*s) / q
    - contactRadius ** 4 * s*s*c*c / q**3;
  return {
    ...result,
    derivative: p.liftDerivativeByAngle,
    secondDerivative: p.liftSecondDerivativeByAngle * hSecond / (p.liftSecondDerivativeByAngle + hSecond),
    radialCoordinate: contactRadius * c,
    contactY: contactRadius * s * c,
    contactZ: contactRadius * c * c,
  };
}
