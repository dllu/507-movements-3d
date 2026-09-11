const smooth = u => u ** 3 * (10 - 15 * u + 6 * u ** 2);
const slope = u => 30 * u ** 2 * (1 - u) ** 2;
const clamp = u => Math.max(0, Math.min(1, u));

export function heldSideDifferentialMotion() {
  const p = { sourceScale: 200, sourceOrigin: [550, 1078.5], driverHeight: (1078.5 - 390.5) / 200,
    pulleyRadius: 1.3675, laneZs: [-0.665, 0, 0.69], pulleyWidths: [0.65, 0.65, 0.71],
    driverSpan: [-1.2, 1.25], driverShaftRadius: 0.185, driverShaftSpan: [-2.15, 2.35],
    outputShaftRadius: 0.205, outputShaftSpan: [-2.02, 2.05], looseBore: 0.211,
    rimInnerRadius: 1.18, directWebEnd: -0.29, carrierWebStart: 1.027,
    brakeHubRadius: 0.26, carrierBore: 0.266, brakeDrumRadius: 0.4, brakeDrumSpan: [1.15, 1.85],
    brakeBandZ: 1.5, brakeBandWidth: 0.17, brakeBandThickness: 0.025, brakeBandClearance: 0.00015,
    brakeTailLength: 1.10, planetSpindleRadius: 0.055, planetBore: 0.061,
    planetSpindleSpan: [0.24, 1.20], planetHubEnd: 0.76,
    bevelCenterZ: 0.545, sideTeeth: 26, planetTeeth: 20, sideInnerDistance: 0.25, sideOuterDistance: 0.44,
    toothHeight: 0.085, toothThicknessFactor: 0.999, pressureAngle: Math.PI / 9, flankSegments: 64, tipSegments: 16,
    beltWidth: 0.34, beltThickness: 0.02, beltClearance: 0.00015,
    selectionSequence: [0, 1, 2, 1], dwellDuration: 2.4, shiftDuration: 0.9, driverTurnPerDwell: Math.PI };
  p.sideConeAngle = Math.atan(p.sideTeeth / p.planetTeeth);
  p.planetConeAngle = Math.PI / 2 - p.sideConeAngle;
  p.planetInnerDistance = p.sideInnerDistance * p.sideTeeth / p.planetTeeth;
  p.planetOuterDistance = p.sideOuterDistance * p.sideTeeth / p.planetTeeth;
  p.beltPitchRadius = p.pulleyRadius + p.beltThickness / 2 + p.beltClearance;
  p.stageDuration = p.dwellDuration + p.shiftDuration;
  p.cycleDuration = p.stageDuration * p.selectionSequence.length;
  const outputPrefix = [0], loosePrefix = [0], turn = p.driverTurnPerDwell;
  for (const selected of p.selectionSequence) {
    outputPrefix.push(outputPrefix.at(-1) + selected * turn);
    loosePrefix.push(loosePrefix.at(-1) + (selected === 0 ? turn : 0));
  }
  const atTime = time => {
    const cycle = Math.floor(time / p.cycleDuration), cycleTime = time - cycle * p.cycleDuration;
    const stage = Math.min(p.selectionSequence.length - 1, Math.floor(cycleTime / p.stageDuration));
    const stageTime = cycleTime - stage * p.stageDuration, selected = p.selectionSequence[stage];
    const next = p.selectionSequence[(stage + 1) % p.selectionSequence.length];
    const u = clamp(stageTime / p.dwellDuration), v = clamp((stageTime - p.dwellDuration) / p.shiftDuration);
    const progress = smooth(u), velocity = slope(u) / p.dwellDuration;
    const driverAngle = (cycle * p.selectionSequence.length + stage + progress) * turn;
    const outputAngle = cycle * outputPrefix.at(-1) + outputPrefix[stage] + selected * turn * progress;
    const outputSpeed = selected * turn * velocity, carrierAngle = outputAngle / 2, carrierSpeed = outputSpeed / 2;
    return { time, cycle, stage, stageTime, selected, next, shifting: stageTime > p.dwellDuration,
      driverAngle, driverSpeed: turn * velocity, outputAngle, outputSpeed, carrierAngle, carrierSpeed,
      brakeAngle: 0, brakeSpeed: 0,
      planetAngle: carrierAngle * p.sideTeeth / p.planetTeeth,
      planetSpeed: carrierSpeed * p.sideTeeth / p.planetTeeth,
      looseAngle: cycle * loosePrefix.at(-1) + loosePrefix[stage] + (selected === 0 ? turn * progress : 0),
      looseSpeed: selected === 0 ? turn * velocity : 0,
      beltZ: p.laneZs[selected] + (p.laneZs[next] - p.laneZs[selected]) * smooth(v),
      beltAxialSpeed: (p.laneZs[next] - p.laneZs[selected]) * slope(v) / p.shiftDuration,
      beltDistance: -p.beltPitchRadius * driverAngle, beltLinearSpeed: -p.beltPitchRadius * turn * velocity };
  };
  return { parameters: p, atTime };
}
