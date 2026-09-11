import defaultProfile from '../data/single-tooth-index-profile.js';

const turn = 2 * Math.PI;

// Contact-constrained loaded motion with an explicit entry event.
export function makeSingleToothIndexMotion(profile = defaultProfile) {
  const p = profile.parameters, rows = profile.motionRows;
  const atTime = time => {
    const inputAngle = p.sourceAngle - p.driverSpeed * time;
    const cycle = Math.floor((Math.PI - inputAngle) / turn), angle = inputAngle + cycle * turn;
    let q, outputSpeed = 0;
    if (angle >= rows[0][0]) q = rows[0][1];
    else if (angle <= rows.at(-1)[0]) q = rows.at(-1)[1];
    else {
      let low = 0, high = rows.length - 1;
      while (high - low > 1) {
        const mid = (low + high) >> 1;
        if (rows[mid][0] > angle) low = mid; else high = mid;
      }
      const span = rows[low][0] - rows[high][0], fraction = (rows[low][0] - angle) / span;
      q = rows[low][1] + fraction * (rows[high][1] - rows[low][1]);
      outputSpeed = p.driverSpeed * (rows[high][1] - rows[low][1]) / span;
    }
    const indexing = outputSpeed > 1e-7;
    return { time, cycle, inputAngle, inputSpeed: -p.driverSpeed, outputAngle: cycle * p.pitch + q,
      outputSpeed, indexing, stage: indexing ? 'contact-projection-index' : 'contact-projection-dwell',
      cycleClosureError: p.cycleClosureError };
  };
  return { parameters: p, atTime };
}
