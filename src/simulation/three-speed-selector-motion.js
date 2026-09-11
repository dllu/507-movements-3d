const smooth = u => u ** 3 * (10 - 15 * u + 6 * u ** 2);
const slope = u => 30 * u ** 2 * (1 - u) ** 2;

export function threeSpeedSelectorMotion() {
  const p = { inputTeeth: [17, 26, 40], outputTeeth: [39, 30, 16], centerDistance: 1.4175,
    sourceScale: 200, sourceOrigin: [910, 761], driverHeight: (761 - 239.5) / 200,
    gearZs: [-3.69, -2.86, -1.925], gearDepths: [0.375, 0.40, 0.44],
    laneZs: [0.87, 0.29, -0.29, -0.87], pulleyWidth: 0.56, pulleyRadius: 1.10,
    beltWidth: 0.43, beltThickness: 0.02, beltClearance: 0.00015,
    shaftRadii: [0.175, 0.265, 0.3425], sleeveBores: [0, 0.181, 0.271], outputShaftRadius: 0.155,
    pressureAngle: Math.PI / 9, toothBacklash: 0.00002, selectionSequence: [0, 1, 2, 3, 2, 1],
    dwellDuration: 2.4, shiftDuration: 0.9, driverTurnPerDwell: Math.PI };
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
