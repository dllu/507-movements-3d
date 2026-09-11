import profile from '../data/jointed-tappet-profile.js';

// Linear interpolation preserves the certified contact bounds of the cache.
// The first turn includes the release from the pose drawn in the engraving;
// subsequent turns begin with the tappet resting on its physical stop.
export function sampleJointedTappetMotion(time, {period = profile.period} = {}) {
  if (!Number.isFinite(time) || !Number.isFinite(period) || period <= 0) {
    throw new Error('Invalid playback clock');
  }
  const physicsTime = Math.max(0, time) * profile.physicsPeriod / period;
  const cycle = Math.floor(physicsTime / profile.physicsPeriod);
  const local = physicsTime - cycle * profile.physicsPeriod;
  const table = cycle === 0 ? profile.first : profile.steady;
  let low = 0;
  let high = table.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (table[middle][0] <= local) low = middle;
    else high = middle;
  }
  const a = table[low];
  const b = table[high];
  const fraction = Math.max(0, Math.min(1, (local - a[0]) / (b[0] - a[0])));
  const x = a.slice(1).map((value, k) => value + fraction * (b[k + 1] - value));
  const angularVelocities = a.slice(1).map((value, k) =>
    (b[k + 1] - value) / (b[0] - a[0]) * profile.physicsPeriod / period);
  x[2] += cycle * profile.geometry.pitch;
  return {
    q: x[0], alpha: x[1], theta: x[2], holdingAngle: x[3],
    driverAngle: -2 * Math.PI * physicsTime / profile.physicsPeriod,
    cycle, phase: local / profile.physicsPeriod, physicsTime, period,
    angularVelocities,
  };
}
