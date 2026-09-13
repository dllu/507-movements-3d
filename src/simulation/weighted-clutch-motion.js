// Only the internal coordinates repeat. The motor keeps its accumulated angle
// so the bevel wheels, including their spokes, never reset at the loop seam.
export function makeWeightedClutchMotion(profile) {
  const {samples, period, playbackPeriod, phaseOffset, inputAtStart, omegaInput, modelStartTime} = profile;
  const rate = period / playbackPeriod;
  function atTime(time) {
    if (!Number.isFinite(time)) throw Error('Nonfinite weighted clutch time');
    const elapsed = Math.max(0, time) * rate + phaseOffset;
    const localTime = elapsed - Math.floor(elapsed / period) * period;
    let lo = 0, hi = samples.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid][0] <= localTime) lo = mid; else hi = mid; }
    const a = samples[lo], b = samples[hi], fraction = (localTime - a[0]) / (b[0] - a[0]);
    return {q: a.slice(1).map((value, i) => value + fraction * (b[i + 1] - value)),
      inputAngle: inputAtStart + omegaInput * elapsed, localTime, modelTime: modelStartTime + localTime};
  }
  return {atTime, rate, period: playbackPeriod};
}
