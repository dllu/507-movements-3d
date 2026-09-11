const tau = 2 * Math.PI;
const smooth = u => u * u * u * (10 + u * (-15 + 6 * u));
const smoothDerivative = u => 30 * u * u * (1 - u) * (1 - u);

export function latheLeverMotion({ largeTeeth = 38, pinionTeeth = 12, module = 0.1,
  runDuration = 2.4, shiftDuration = 1.2, leverAngle = 53 * Math.PI / 180,
  camEccentricX = 0.028, camEccentricY = 0.585, leverRadius = 0.91,
  pinionHeight = 0.032, largePhase = 74.93359141372608 * Math.PI / 180,
  loadPhase = 0.000412 } = {}) {
  const distance = (largeTeeth + pinionTeeth) * module / 2;
  const pinionX = Math.sqrt(distance ** 2 - pinionHeight ** 2);
  const lineAngle = Math.atan2(pinionHeight, pinionX);
  const pinionPhase = ((pinionTeeth - 1) * Math.PI + (largeTeeth + pinionTeeth) * lineAngle - largeTeeth * largePhase) / pinionTeeth;
  const camRadius = Math.hypot(leverRadius - camEccentricX, camEccentricY);
  const cycleDuration = 2 * (runDuration + shiftDuration);
  const follower = angle => {
    const x = camEccentricX * Math.cos(angle) - camEccentricY * Math.sin(angle);
    const y = camEccentricX * Math.sin(angle) + camEccentricY * Math.cos(angle);
    return x + Math.sqrt(camRadius ** 2 - y * y);
  };
  const throwDistance = leverRadius - follower(leverAngle);
  const atTime = time => {
    const cycleIndex = Math.floor(time / cycleDuration);
    const t = time - cycleIndex * cycleDuration;
    let engagedTurns = 0, freeTurns = 0, inputSpeed = 0, outputSpeed = 0, angle = 0, angularSpeed = 0, branch;
    if (t < runDuration) {
      const u = t / runDuration; branch = 'engaged-run'; engagedTurns = smooth(u);
      inputSpeed = tau * smoothDerivative(u) / runDuration; outputSpeed = -inputSpeed * pinionTeeth / largeTeeth;
    } else if (t < runDuration + shiftDuration) {
      const u = (t - runDuration) / shiftDuration; branch = 'stopped-withdrawal'; engagedTurns = 1;
      angle = leverAngle * smooth(u); angularSpeed = leverAngle * smoothDerivative(u) / shiftDuration;
    } else if (t < 2 * runDuration + shiftDuration) {
      const u = (t - runDuration - shiftDuration) / runDuration; branch = 'disengaged-run'; engagedTurns = 1; freeTurns = smooth(u);
      inputSpeed = tau * smoothDerivative(u) / runDuration; angle = leverAngle;
    } else {
      const u = (t - 2 * runDuration - shiftDuration) / shiftDuration; branch = 'stopped-return'; engagedTurns = 1; freeTurns = 1;
      angle = leverAngle * (1 - smooth(u)); angularSpeed = -leverAngle * smoothDerivative(u) / shiftDuration;
    }
    const radius = follower(angle), outputX = radius - leverRadius;
    const centerX = camEccentricX * Math.cos(angle) - camEccentricY * Math.sin(angle);
    const centerY = camEccentricX * Math.sin(angle) + camEccentricY * Math.cos(angle);
    const outputLinearSpeed = -centerY * (1 + centerX / Math.sqrt(camRadius ** 2 - centerY ** 2)) * angularSpeed;
    return { time, cycleIndex, branch, leverAngle: angle, leverAngularSpeed: angularSpeed,
      outputX, outputLinearSpeed, throwDistance: -outputX, pinionX, pinionHeight,
      pinionAngle: pinionPhase + tau * (2 * cycleIndex + engagedTurns + freeTurns),
      largeAngle: largePhase + loadPhase - tau * pinionTeeth / largeTeeth * (cycleIndex + engagedTurns),
      inputSpeed, outputSpeed, engaged: branch === 'engaged-run' };
  };
  return { parameters: { largeTeeth, pinionTeeth, module, distance, pinionX, pinionHeight, lineAngle,
    runDuration, shiftDuration, cycleDuration, leverAngle, leverRadius, camEccentricX, camEccentricY, camRadius,
    throwDistance, pinionPhase, largePhase, loadPhase }, atTime, follower };
}
