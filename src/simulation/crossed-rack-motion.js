import profile from '../data/crossed-rack-profile.js';

// Movement 080 plays a MuJoCo motion baked offline by
// scripts/bake-crossed-rack-mujoco.mjs; nothing is simulated in the browser.
// Rows: physical time tau in the loop, rack height, left and right pawl angles.
// The lever is analytic, q = -A cos(2 pi tau / period); display time zero is a
// quarter swing into the loop, with the lever level and rising on the right.
const rows = profile.rows, loop = profile.loopPeriod;

function tableState(tau) {
 let low = 0, high = rows.length - 1;
 while (high - low > 1) {const middle = (low + high) >> 1; if (rows[middle][0] <= tau) low = middle; else high = middle;}
 const a = rows[low], b = rows[high], h = b[0] - a[0], f = Math.max(0, Math.min(1, (tau - a[0]) / h));
 return {x: [1, 2, 3].map(i => a[i] + f * (b[i] - a[i])), v: [1, 2, 3].map(i => (b[i] - a[i]) / h)};
}

export function sampleCrossedRackMotion(time, {period = profile.playbackPeriod} = {}) {
 if (!Number.isFinite(time) || !Number.isFinite(period) || period <= 0) throw Error('Invalid playback time or period');
 const rate = profile.physicsPeriod / period, unwrapped = Math.max(0, time) * rate + profile.displayOffset,
  tau = unwrapped - Math.floor(unwrapped / loop) * loop, omega = 2 * Math.PI / profile.physicsPeriod, A = profile.amplitude,
  {x, v} = tableState(tau);
 return {q: -A * Math.cos(omega * tau), rackY: x[0], leftAngle: x[1], rightAngle: x[2], rackVelocity: v[0] * rate,
  angularVelocities: [rate * A * omega * Math.sin(omega * tau), v[1] * rate, v[2] * rate],
  physicsTime: tau, period, duration: loop / rate, finished: false, inputStopped: false, returning: tau > 2 * profile.physicsPeriod};
}
