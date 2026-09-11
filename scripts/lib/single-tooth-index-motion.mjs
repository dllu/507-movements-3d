const turn = 2 * Math.PI;
export function singleToothIndexParameters(options = {}) {
  const p = { notches: 10, centerDistance: 2.72, driverRadius: 1.36,
    headOrbit: 1.44, headRadius: 0.07, outputRadius: 1.45, clearance: 0.00015,
    driverSpeed: 1, sourceAngle: 0.75, depth: 0.24, ...options };
  p.pitch = turn / p.notches; p.halfPitch = p.pitch / 2;
  p.halfIndex = options.halfIndex ?? (Math.asin(p.centerDistance / p.headOrbit * Math.sin(p.halfPitch)) - p.halfPitch);
  p.period = turn / p.driverSpeed;
  return p;
}

export function makeSingleToothIndexMotion(options = {}) {
  const p = singleToothIndexParameters(options);
  const atTime = time => {
    const inputAngle = p.sourceAngle - p.driverSpeed * time;
    const cycle = Math.floor((Math.PI - inputAngle) / turn);
    const angle = inputAngle + cycle * turn;
    let advance, outputSpeed, stage;
    if (angle > p.halfIndex) { advance = -p.halfPitch; outputSpeed = 0; stage = 'locked-before-index'; }
    else if (angle < -p.halfIndex) { advance = p.halfPitch; outputSpeed = 0; stage = 'locked-after-index'; }
    else if (p.indexLaw === 'constant-ratio') {
      advance = -angle * p.halfPitch / p.halfIndex;
      outputSpeed = p.driverSpeed * p.halfPitch / p.halfIndex;
      stage = 'tooth-index';
    } else {
      const x = p.headOrbit * Math.cos(angle) - p.centerDistance, y = p.headOrbit * Math.sin(angle);
      advance = Math.atan2(-y, -x);
      outputSpeed = p.driverSpeed * p.headOrbit * (p.centerDistance * Math.cos(angle) - p.headOrbit) / (x * x + y * y);
      stage = 'tooth-index';
    }
    return { time, cycle, inputAngle, outputAngle: cycle * p.pitch + advance,
      inputSpeed: -p.driverSpeed, outputSpeed, stage, indexing: stage === 'tooth-index' };
  };
  return { parameters: p, atTime };
}

// An isolated contact-projection table, kept separate from the trial analytic
// laws. Its small cycle closure residual is reported, not silently corrected.
export function makeSingleToothProfileMotion(profile) {
  if (!profile.motionRows) return makeSingleToothIndexMotion(profile.parameters);
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
