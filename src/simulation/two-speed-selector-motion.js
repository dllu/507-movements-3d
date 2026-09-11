const smooth = u => u ** 3 * (10 - 15 * u + 6 * u ** 2);
const slope = u => 30 * u ** 2 * (1 - u) ** 2;

export function twoSpeedSelectorMotion() {
  const p = { inputTeeth: [12, 45], outputTeeth: [42, 9], centerDistance: 1.3325,
    sourceScale: 200, sourceOrigin: [750, 828.5], driverHeight: (828.5 - 244.75) / 200,
    gearZs: [-1.56, 1.66], gearDepths: [0.425, 0.40],
    laneZs: [-0.5, 0, 0.5], pulleyWidth: 0.48, pulleyRadius: 1.125,
    beltWidth: 0.26, beltThickness: 0.018, beltClearance: 0.00015,
    shaftRadii: [0.1425, 0.2725], sleeveBores: [0, 0.1485], outputShaftRadius: 0.1375,
    pressureAngle: Math.PI / 6, toothBacklash: 0.00002, selectionSequence: [0, 1, 2, 1],
    dwellDuration: 2.4, shiftDuration: 0.9, driverTurnPerDwell: Math.PI / 2 };
  p.module = 2 * p.centerDistance / (p.inputTeeth[0] + p.outputTeeth[0]);
  p.beltPitchRadius = p.pulleyRadius + p.beltThickness / 2 + p.beltClearance;
  p.stageDuration = p.dwellDuration + p.shiftDuration;
  p.cycleDuration = p.stageDuration * p.selectionSequence.length;
  const outputTurns = [0, ...p.inputTeeth.map((n, i) => -p.driverTurnPerDwell * n / p.outputTeeth[i])];
  const outputPrefix = [0], loosePrefix = [0];
  for (const selection of p.selectionSequence) {
    outputPrefix.push(outputPrefix.at(-1) + outputTurns[selection]);
    loosePrefix.push(loosePrefix.at(-1) + (selection === 0 ? p.driverTurnPerDwell : 0));
  }
  p.inputPhases = p.inputTeeth.map(() => Math.PI / 2);
  p.outputPhases = p.inputTeeth.map((n, i) => ((p.outputTeeth[i] - 1) * Math.PI
    - (n + p.outputTeeth[i]) * Math.PI / 2 - n * p.inputPhases[i]) / p.outputTeeth[i]);
  const atTime = time => {
    const cycle = Math.floor(time / p.cycleDuration), cycleTime = time - cycle * p.cycleDuration;
    const stage = Math.min(p.selectionSequence.length - 1, Math.floor(cycleTime / p.stageDuration));
    const stageTime = cycleTime - stage * p.stageDuration, selected = p.selectionSequence[stage];
    const next = p.selectionSequence[(stage + 1) % p.selectionSequence.length];
    const u = Math.max(0, Math.min(1, stageTime / p.dwellDuration));
    const v = Math.max(0, Math.min(1, (stageTime - p.dwellDuration) / p.shiftDuration));
    const progress = smooth(u), velocity = slope(u) / p.dwellDuration;
    const driverAngle = (cycle * p.selectionSequence.length + stage + progress) * p.driverTurnPerDwell;
    const outputAngle = cycle * outputPrefix.at(-1) + outputPrefix[stage] + outputTurns[selected] * progress;
    const outputSpeed = outputTurns[selected] * velocity;
    const looseAngle = cycle * loosePrefix.at(-1) + loosePrefix[stage] + (selected === 0 ? p.driverTurnPerDwell * progress : 0);
    return { time, cycle, stage, stageTime, selected, next, shifting: stageTime > p.dwellDuration,
      driverAngle, driverSpeed: p.driverTurnPerDwell * velocity, outputAngle, outputSpeed,
      inputAngles: p.inputTeeth.map((n, i) => -p.outputTeeth[i] / n * outputAngle),
      inputSpeeds: p.inputTeeth.map((n, i) => -p.outputTeeth[i] / n * outputSpeed),
      looseAngle, looseSpeed: selected === 0 ? p.driverTurnPerDwell * velocity : 0,
      beltZ: p.laneZs[selected] + (p.laneZs[next] - p.laneZs[selected]) * smooth(v),
      beltAxialSpeed: (p.laneZs[next] - p.laneZs[selected]) * slope(v) / p.shiftDuration,
      beltDistance: -p.beltPitchRadius * driverAngle,
      beltLinearSpeed: -p.beltPitchRadius * p.driverTurnPerDwell * velocity };
  };
  return { parameters: p, atTime };
}
