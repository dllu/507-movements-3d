// Refine the phase of the generating hob continuously for each wheel radial
// ray. A neighboring-cell minimum is deliberately not applied: that operation
// flattens the axial ends of working flanks and changes their force direction.
export function generateWormWheelProfile(parameters, { angularSteps = 256, axialSteps = 32,
  phaseSteps = 1600, radialSteps = 80, clearance = 0.0004 } = {}) {
  const { teeth, pitchRadius, wormPitchRadius, wormLength, depth, pressureAngle } = parameters;
  const key = JSON.stringify({ teeth, pitchRadius, wormPitchRadius, wormLength, depth, pressureAngle });
  const turn = Math.PI * 2, module = 2 * pitchRadius / teeth, pitch = turn / teeth, axialPitch = Math.PI * module;
  const lead = axialPitch / turn, distance = pitchRadius + wormPitchRadius, tangent = Math.tan(pressureAngle);
  const tip = wormPitchRadius + 1.25 * module, root = wormPitchRadius - 1.25 * module, outer = pitchRadius + module;
  const sweep = Math.acos((distance - tip) / outer) + pitch / 2, phaseStep = 2 * sweep / phaseSteps;
  const radii = new Float64Array((axialSteps + 1) * (angularSteps + 1)), phases = new Float64Array(radii.length);
  const wrap = value => value - axialPitch * Math.floor(value / axialPitch + 0.5);
  const boundary = (theta, z, phase) => {
    const sine = Math.sin(theta + phase), cosine = Math.cos(theta + phase);
    // The worm is a cylinder around X. Its radial distance is hypot(y,z),
    // independent of x; a sphere/radial-circle discriminant would wrongly
    // discard cutter material away from the central wheel plane.
    if (Math.abs(z) >= tip || cosine <= 0) return Infinity;
    const extent = Math.sqrt(tip ** 2 - z ** 2);
    const start = (distance - extent) / cosine;
    const end = Math.min(outer, (distance + extent) / cosine,
      Math.abs(sine) > 1e-12 ? wormLength / (2 * Math.abs(sine)) : Infinity);
    if (start >= end) return Infinity;
    const inside = radius => {
      const x = -radius * sine; if (Math.abs(x) > wormLength / 2) return false;
      const y = radius * cosine - distance, r = Math.hypot(y, z);
      if (r < root) return true;
      const angle = Math.atan2(y, -z) + Math.PI / 2 - teeth * phase;
      return r <= tip + 1e-12 && Math.abs(wrap(x - lead * angle)) + (r - wormPitchRadius) * tangent <= axialPitch / 4;
    };
    let before = start;
    for (let i = 0; i <= radialSteps; i += 1) {
      const sample = start + (end - start) * i / radialSteps;
      if (inside(sample)) {
        let low = before, high = sample;
        for (let j = 0; j < 42; j += 1) { const middle = (low + high) / 2; if (inside(middle)) high = middle; else low = middle; }
        return high;
      }
      before = sample;
    }
    return Infinity;
  };
  for (let axial = 0; axial <= axialSteps; axial += 1) {
    const z = -depth / 2 + depth * axial / axialSteps;
    for (let angular = 0; angular <= angularSteps; angular += 1) {
      const theta = -pitch / 2 + pitch * angular / angularSteps, index = axial * (angularSteps + 1) + angular;
      let best = outer, bestPhase = null;
      for (let i = 0; i <= phaseSteps; i += 1) {
        const phase = -sweep + phaseStep * i, radius = boundary(theta, z, phase);
        if (radius < best) { best = radius; bestPhase = phase; }
      }
      if (bestPhase !== null) {
        let low = bestPhase - phaseStep, high = bestPhase + phaseStep;
        const ratio = (Math.sqrt(5) - 1) / 2;
        let a = high - ratio * (high - low), b = low + ratio * (high - low);
        let fa = boundary(theta, z, a), fb = boundary(theta, z, b);
        for (let i = 0; i < 54; i += 1) {
          if (fa < fb) { high = b; b = a; fb = fa; a = high - ratio * (high - low); fa = boundary(theta, z, a); }
          else { low = a; a = b; fa = fb; b = low + ratio * (high - low); fb = boundary(theta, z, b); }
        }
        if (fa < best) { best = fa; bestPhase = a; }
        if (fb < best) { best = fb; bestPhase = b; }
      }
      radii[index] = best - clearance; phases[index] = bestPhase ?? 0;
    }
  }
  let maximumSeamResidual = 0;
  for (let axial = 0; axial <= axialSteps; axial += 1) {
    const first = axial * (angularSteps + 1), last = first + angularSteps;
    maximumSeamResidual = Math.max(maximumSeamResidual, Math.abs(radii[first] - radii[last]));
    radii[first] = radii[last] = Math.min(radii[first], radii[last]);
  }
  return { id: `cylindrical-hob-${angularSteps}-${axialSteps}-${phaseSteps}-${radialSteps}-${clearance}`, key,
    angularSteps, axialSteps, phaseSteps, radialSteps, clearance, maximumSeamResidual, radii: Array.from(radii), generatingPhases: Array.from(phases) };
}
