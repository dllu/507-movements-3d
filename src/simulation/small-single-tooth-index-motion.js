import defaultProfile from '../data/small-single-tooth-index-profile.js';

export function makeSmallSingleToothMotion(profile = defaultProfile) {
  const p = profile.parameters, rows = profile.motion;
  const atTime = time => {
    const coordinate = (time + p.initialInputPhase) / p.period, cycle = Math.floor(coordinate);
    const angle = (coordinate - cycle) * p.period;
    let advance = 0, speed = 0;
    if (angle >= rows.at(-1)[0]) advance = rows.at(-1)[1];
    else if (angle > rows[0][0]) {
      let low = 0, high = rows.length - 1;
      while (high - low > 1) { const mid = (low + high) >> 1; if (rows[mid][0] <= angle) low = mid; else high = mid; }
      const a = rows[low], b = rows[high], span = b[0] - a[0];
      speed = (b[1] - a[1]) / span; advance = a[1] + speed * (angle - a[0]);
    }
    return { time, cycle, inputAngle: time + p.initialInputPhase, inputSpeed: 1,
      outputAngle: p.initialQ - cycle * p.advancePerCycle - advance, outputSpeed: -speed,
      advance: cycle * p.advancePerCycle + advance, indexing: speed > 1e-4,
      cycleClosureError: p.cycleClosureError };
  };
  return { parameters: p, atTime };
}
