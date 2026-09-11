const smooth = u => u ** 3 * (10 - 15 * u + 6 * u ** 2);
const slope = u => 30 * u ** 2 * (1 - u) ** 2;
const clamp = u => Math.max(0, Math.min(1, u));

export function dualInputDifferentialMotion() {
  const p = {
  "sourceScale": 200,
  "sourceOrigin": [
    610,
    1066
  ],
  "driverHeight": 3.29,
  "driverRadius": 1.385,
  "sideDriverRadius": 0.725,
  "pulleyRadius": 1.425,
  "driverSpan": [
    -1.18,
    0.6
  ],
  "sideDriverSpan": [
    0.61,
    2.04
  ],
  "driverShaftRadius": 0.225,
  "driverShaftSpan": [
    -2.485,
    2.79
  ],
  "outputShaftRadius": 0.2125,
  "outputShaftSpan": [
    -2.3,
    2.55
  ],
  "pulleySpans": [
    [
      -0.91,
      -0.3
    ],
    [
      -0.29,
      0.27
    ],
    [
      0.28,
      0.865
    ],
    [
      0.875,
      1.4
    ]
  ],
  "bandZs": [
    -0.55,
    -0.04,
    0.435
  ],
  "sideBandZ": 1.125,
  "beltWidth": 0.3,
  "beltThickness": 0.02,
  "beltClearance": 0.00015,
  "looseBore": 0.2185,
  "sideHubRadius": 0.27,
  "carrierBore": 0.276,
  "rimInnerRadius": 1.24,
  "directWebEnd": -0.27,
  "carrierWebStart": 0.848,
  "bevelCenterZ": 0.45,
  "sideTeeth": 34,
  "planetTeeth": 20,
  "sideInnerDistance": 0.215,
  "sideOuterDistance": 0.35,
  "toothHeight": 0.072,
  "pressureAngle": 0.3490658503988659,
  "toothThicknessFactor": 0.999,
  "flankSegments": 64,
  "tipSegments": 16,
  "planetSpindleRadius": 0.055,
  "planetBore": 0.061,
  "planetSpindleSpan": [
    0.245,
    1.255
  ],
  "planetHubEnd": 0.795,
  "sideConeAngle": 1.039072259536091,
  "planetConeAngle": 0.5317240672588055,
  "planetInnerDistance": 0.3655,
  "planetOuterDistance": 0.595
};
  Object.assign(p, { selectionSequence: [0, 1, 2, 1], dwellDurations: [0.5, 2.4, 2.4, 2.4],
    shiftDuration: 0.9, driverTurnPerDwell: Math.PI, crossoverLift: 0.24 });
  const offset = p.beltThickness / 2 + p.beltClearance;
  p.driverPitchRadius = p.driverRadius + offset;
  p.sideDriverPitchRadius = p.sideDriverRadius + offset;
  p.pulleyPitchRadius = p.pulleyRadius + offset;
  p.mainRatio = p.driverPitchRadius / p.pulleyPitchRadius;
  p.sideRatio = p.sideDriverPitchRadius / p.pulleyPitchRadius;
  p.stageStarts = [0];
  for (const dwell of p.dwellDurations) p.stageStarts.push(p.stageStarts.at(-1) + dwell + p.shiftDuration);
  p.cycleDuration = p.stageStarts.at(-1);
  const prefixFor = configuration => {
    if (!['open', 'crossed'].includes(configuration)) throw new RangeError('Unknown auxiliary belt configuration');
    const sign = configuration === 'open' ? 1 : -1;
    const deltas = p.selectionSequence.map(selected => {
      const driver = selected === 0 ? 0 : p.driverTurnPerDwell;
      const side = sign * p.sideRatio * driver;
      const output = selected === 2 ? 2 * p.mainRatio * driver - side : p.mainRatio * driver;
      return { driver, side, output, carrier: (output + side) / 2,
        planet: (output - side) / 2 * p.sideTeeth / p.planetTeeth };
    });
    const prefixes = [{ driver: 0, side: 0, output: 0, carrier: 0, planet: 0 }];
    for (const delta of deltas) prefixes.push(Object.fromEntries(Object.entries(delta)
      .map(([key, value]) => [key, prefixes.at(-1)[key] + value])));
    return { sign, deltas, prefixes };
  };
  const plans = { open: prefixFor('open'), crossed: prefixFor('crossed') };
  const atTime = (time, configuration = 'open') => {
    if (!plans[configuration]) throw new RangeError('Unknown auxiliary belt configuration');
    const { sign, deltas, prefixes } = plans[configuration];
    const cycle = Math.floor(time / p.cycleDuration), cycleTime = time - cycle * p.cycleDuration;
    const nextBoundary = p.stageStarts.findIndex(end => end > cycleTime);
    const stage = nextBoundary < 0 ? p.selectionSequence.length - 1 : Math.max(0, nextBoundary - 1);
    const stageTime = cycleTime - p.stageStarts[stage], selected = p.selectionSequence[stage];
    const next = p.selectionSequence[(stage + 1) % p.selectionSequence.length];
    const dwellDuration = p.dwellDurations[stage];
    const u = clamp(stageTime / dwellDuration), v = clamp((stageTime - dwellDuration) / p.shiftDuration);
    const progress = smooth(u), velocity = slope(u) / dwellDuration;
    const state = { time, cycle, stage, stageTime, selected, next, configuration, orientationSign: sign,
      shifting: stageTime > dwellDuration, inputStopped: selected === 0 || stageTime >= dwellDuration,
      looseAngle: 0, looseSpeed: 0,
      beltZ: p.bandZs[selected] + (p.bandZs[next] - p.bandZs[selected]) * smooth(v),
      beltAxialSpeed: (p.bandZs[next] - p.bandZs[selected]) * slope(v) / p.shiftDuration };
    for (const key of Object.keys(deltas[stage])) {
      state[key + 'Angle'] = cycle * prefixes.at(-1)[key] + prefixes[stage][key] + deltas[stage][key] * progress;
      state[key + 'Speed'] = deltas[stage][key] * velocity;
    }
    state.beltDistance = -p.driverPitchRadius * state.driverAngle;
    state.beltLinearSpeed = -p.driverPitchRadius * state.driverSpeed;
    state.sideBeltDistance = -p.sideDriverPitchRadius * state.driverAngle;
    state.sideBeltLinearSpeed = -p.sideDriverPitchRadius * state.driverSpeed;
    return state;
  };
  return { parameters: p, atTime, plans };
}
