const smooth = u => u ** 3 * (10 - 15 * u + 6 * u ** 2);
const slope = u => 30 * u ** 2 * (1 - u) ** 2;
const clamp = u => Math.max(0, Math.min(1, u));

export function dualBeltSpeedsMotion() {
  const p = { sourceScale: 200, sourceOrigin: [640, 1047], driverHeight: (1047 - 371) / 200,
    driverRadii: [1.30, 0.7325], lowerRadius: 1.2625,
    laneZs: [(367 - 640) / 200, (493 - 640) / 200, (790 - 640) / 200, (911 - 640) / 200],
    pulleyWidths: [0.63, 0.615, 0.54, 0.64], bandOffset: -0.055,
    driverSpans: [[-1.675, -0.395], [0.47, 1.68]],
    driverShaftRadius: 0.18, driverShaftSpan: [-2.65, 2.35],
    outputShaftRadius: 0.1925, outputShaftSpan: [-2.79, 2.68], looseBore: 0.1985,
    beltWidth: 0.285, beltThickness: 0.02, beltClearance: 0.00015,
    dwellDuration: 2.4, shiftDuration: 0.9, driverTurnPerDwell: Math.PI };
  const pitchOffset = p.beltThickness / 2 + p.beltClearance;
  p.driverPitchRadii = p.driverRadii.map(radius => radius + pitchOffset);
  p.lowerPitchRadius = p.lowerRadius + pitchOffset;
  p.quickRatio = p.driverPitchRadii[0] / p.lowerPitchRadius;
  p.slowRatio = p.driverPitchRadii[1] / p.lowerPitchRadius;
  p.stageDuration = p.dwellDuration + p.shiftDuration;
  p.cycleDuration = 2 * p.stageDuration;
  const turn = p.driverTurnPerDwell;
  const atTime = time => {
    const cycle = Math.floor(time / p.cycleDuration), cycleTime = time - cycle * p.cycleDuration;
    const stage = Math.min(1, Math.floor(cycleTime / p.stageDuration)), stageTime = cycleTime - stage * p.stageDuration;
    const u = clamp(stageTime / p.dwellDuration), v = clamp((stageTime - p.dwellDuration) / p.shiftDuration);
    const progress = smooth(u), velocity = slope(u) / p.dwellDuration;
    const driverAngle = (2 * cycle + stage + progress) * turn, driverSpeed = turn * velocity;
    const ratio = stage === 0 ? p.slowRatio : p.quickRatio;
    const outputAngle = turn * (cycle * (p.slowRatio + p.quickRatio) + (stage === 1 ? p.slowRatio : 0) + ratio * progress);
    const fromLanes = stage === 0 ? [0, 2] : [1, 3], toLanes = stage === 0 ? [1, 3] : [0, 2];
    return { time, cycle, stage, stageTime, mode: stage === 0 ? 'slow' : 'quick', shifting: stageTime > p.dwellDuration,
      driverAngle, driverSpeed, outputAngle, outputSpeed: ratio * driverSpeed,
      looseLeftAngle: turn * p.quickRatio * (cycle + (stage === 0 ? progress : 1)),
      looseRightAngle: turn * p.slowRatio * (cycle + (stage === 1 ? progress : 0)),
      looseLeftSpeed: stage === 0 ? p.quickRatio * driverSpeed : 0,
      looseRightSpeed: stage === 1 ? p.slowRatio * driverSpeed : 0,
      fromLanes, toLanes,
      beltZs: fromLanes.map((from, i) => p.laneZs[from] + p.bandOffset + (p.laneZs[toLanes[i]] - p.laneZs[from]) * smooth(v)),
      beltAxialSpeeds: fromLanes.map((from, i) => (p.laneZs[toLanes[i]] - p.laneZs[from]) * slope(v) / p.shiftDuration),
      beltDistances: p.driverPitchRadii.map(radius => -radius * driverAngle),
      beltLinearSpeeds: p.driverPitchRadii.map(radius => -radius * driverSpeed) };
  };
  return { parameters: p, atTime };
}
