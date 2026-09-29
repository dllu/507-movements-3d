import profile from '../data/jointed-tappet-profile.js';

// Linear interpolation preserves the certified contact bounds of the cache.
// p109: every cycle plays the settled (steady) table, so the tappet never
// falls unprompted from Brown's level pose onto its rest key at start-up
// (the first-turn release table is kept only as bake evidence). The level
// tappet of the plate is a pose of the strike: the clock starts at the
// instant the stud has swung the tappet up through Brown's level pose
// (q = 0, A not yet moved), so the default frame shows the plate's C and B.
function levelStrikeTime(table) {
  for (let i = 1; i < table.length; i += 1) {
    const a = table[i - 1];
    const b = table[i];
    if (a[1] > 0 && b[1] <= 0) return a[0] + a[1] / (a[1] - b[1]) * (b[0] - a[0]);
  }
  throw new Error('The steady cycle never passes the level pose');
}
export const LEVEL_STRIKE_PHYSICS_TIME = levelStrikeTime(profile.steady);

export function sampleJointedTappetMotion(time, {period = profile.period} = {}) {
  if (!Number.isFinite(time) || !Number.isFinite(period) || period <= 0) {
    throw new Error('Invalid playback clock');
  }
  const physicsTime = Math.max(0, time) * profile.physicsPeriod / period + LEVEL_STRIKE_PHYSICS_TIME;
  const cycle = Math.floor(physicsTime / profile.physicsPeriod);
  const local = physicsTime - cycle * profile.physicsPeriod;
  const table = profile.steady;
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
    // The driver turns once per driverPeriod; each of its studs strikes
    // once per turn, so one strike cycle (physicsPeriod) is a fraction of it.
    driverAngle: -2 * Math.PI * physicsTime / (profile.driverPeriod ?? profile.physicsPeriod),
    cycle, phase: local / profile.physicsPeriod, physicsTime, period,
    angularVelocities,
  };
}
