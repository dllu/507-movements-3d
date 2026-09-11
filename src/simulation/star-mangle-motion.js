// Geometric path of the right-angle mangle's wheel and input bearing.
// The loaded contact map determines progress along this path.
export function starMangleMotion(options = {}) {
  const p = { wheelPositions: 44, pinionTeeth: 6, omittedTeeth: 3,
    wheelRadius: 1.55, inputSpeed: 4, ...options };
  Object.assign(p, { ratio: p.pinionTeeth / p.wheelPositions,
    module: 2 * p.wheelRadius / p.wheelPositions,
    wheelPitch: 2 * Math.PI / p.wheelPositions,
    toothCount: p.wheelPositions - p.omittedTeeth });
  p.pinionRadius = p.wheelRadius * p.ratio;
  p.firstTerminal = Math.PI + (p.omittedTeeth + 1) * p.wheelPitch / 2;
  p.lastTerminal = p.firstTerminal + (p.toothCount - 1) * p.wheelPitch;
  p.runTravel = (p.toothCount - 1) * 2 * Math.PI / p.pinionTeeth;
  p.rearStart = p.runTravel + Math.PI;
  p.returnStart = 2 * p.runTravel + Math.PI;
  p.cycleTravel = 2 * p.runTravel + 2 * Math.PI;
  p.cycleDuration = p.cycleTravel / p.inputSpeed;
  p.pinionPhase = Math.PI / 2 - Math.PI / p.pinionTeeth;
  function atTravel(travel) {
    const u = ((travel % p.cycleTravel) + p.cycleTravel) % p.cycleTravel;
    let wheelAngle, wheelDerivative, centerY = -p.wheelRadius;
    let centerZ, centerDY = 0, centerDZ = 0, branch, progress;
    let wheelSecondDerivative = 0, centerDDY = 0, centerDDZ = 0;
    if (u < p.runTravel) {
      branch = 'front'; progress = u / p.runTravel;
      wheelAngle = -Math.PI / 2 - p.firstTerminal - p.ratio * u;
      wheelDerivative = -p.ratio; centerZ = p.pinionRadius;
    } else if (u < p.rearStart || u >= p.returnStart) {
      const first = u < p.rearStart, a = u - (first ? p.runTravel : p.returnStart);
      const sign = first ? 1 : -1, sin = Math.sin(a), cos = Math.cos(a);
      const radius = Math.sqrt(p.wheelRadius ** 2 - (p.pinionRadius * sin) ** 2);
      branch = first ? 'last-crossover' : 'first-crossover'; progress = a / Math.PI;
      wheelAngle = -Math.PI / 2 - (first ? p.lastTerminal : p.firstTerminal)
        - sign * Math.asin(p.ratio * sin);
      wheelDerivative = -sign * p.pinionRadius * cos / radius;
      wheelSecondDerivative = sign * p.pinionRadius * sin / radius - sign * p.pinionRadius ** 3 * sin * cos * cos / radius ** 3;
      centerY = -radius; centerZ = sign * p.pinionRadius * cos;
      centerDY = p.pinionRadius ** 2 * sin * cos / radius;
      centerDZ = -sign * p.pinionRadius * sin;
      centerDDY = p.pinionRadius ** 2 * (cos * cos - sin * sin) / radius
        + p.pinionRadius ** 4 * sin * sin * cos * cos / radius ** 3;
      centerDDZ = -sign * p.pinionRadius * cos;
    } else {
      branch = 'rear'; progress = (u - p.rearStart) / p.runTravel;
      wheelAngle = -Math.PI / 2 - p.lastTerminal + p.ratio * (u - p.rearStart);
      wheelDerivative = p.ratio; centerZ = -p.pinionRadius;
    }
    return { travel, branch, progress, wheelAngle, wheelDerivative, wheelSecondDerivative,
      pinionAngle: p.pinionPhase + travel, centerY, centerZ, centerDY, centerDZ, centerDDY, centerDDZ };
  }
  return { parameters: p, atTravel, atTime: (time) => atTravel(time * p.inputSpeed) };
}
