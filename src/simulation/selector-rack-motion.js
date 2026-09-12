import profile from '../data/selector-rack-profile.js';

const ramp = (time, start, end) => {
  const s = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return s ** 3 * (10 - 15 * s + 6 * s * s);
};
export function sampleSelectorRackMotion(displayTime) {
  if (!Number.isFinite(displayTime)) throw Error('Invalid selector-rack playback time');
  const time = Math.max(0, Math.min(profile.duration, displayTime)), knots = profile.knots;
  let low = 0, high = knots.length - 1;
  while (high - low > 1) {const mid = (low + high) >> 1; if (knots[mid][0] <= time) low = mid; else high = mid;}
  const a = knots[low], b = knots[high], f = Math.max(0, Math.min(1, (time - a[0]) / (b[0] - a[0])));
  const x = a.slice(1).map((v, i) => v + f * (b[i + 1] - v));
  let selectorY = profile.neutral;
  for (const p of profile.pulses) selectorY += (p.heightPixels / profile.scale - profile.neutral) * (ramp(time, ...p.rise) - ramp(time, ...p.fall));
  return {time, camAngle: -2 * Math.PI * time / profile.period, selectorY, center: x.slice(0, 2), frameAngle: x[2],
    finished: displayTime >= profile.duration, duration: profile.duration};
}
