import profile from '../data/selector-rack-profile.js';

const ramp = (time, start, end) => {
  const s = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return s ** 3 * (10 - 15 * s + 6 * s * s);
};
// The recorded demonstration closes on itself: from 3.05 s to 15.05 s (four
// whole cam turns) the cam carries the rack through the same contact stroke
// into the same pose (rack states agree to 1e-9 px) with the governor rod in
// the same lower selection. Playback runs the recording once from rest and
// then repeats that closed span forever, so there is no end and no jump.
export const SELECTOR_RACK_LOOP = {start: 3.05, end: 15.05};
export function selectorRackRecordingTime(displayTime) {
  const {start, end} = SELECTOR_RACK_LOOP;
  if (displayTime < end) return Math.max(0, displayTime);
  return start + (((displayTime - start) % (end - start)) + (end - start)) % (end - start);
}
export function sampleSelectorRackMotion(displayTime) {
  if (!Number.isFinite(displayTime)) throw Error('Invalid selector-rack playback time');
  const time = selectorRackRecordingTime(displayTime), knots = profile.knots;
  let low = 0, high = knots.length - 1;
  while (high - low > 1) {const mid = (low + high) >> 1; if (knots[mid][0] <= time) low = mid; else high = mid;}
  const a = knots[low], b = knots[high], f = Math.max(0, Math.min(1, (time - a[0]) / (b[0] - a[0])));
  const x = a.slice(1).map((v, i) => v + f * (b[i + 1] - v));
  let selectorY = profile.neutral;
  for (const p of profile.pulses) selectorY += (p.heightPixels / profile.scale - profile.neutral) * (ramp(time, ...p.rise) - ramp(time, ...p.fall));
  return {time, camAngle: -2 * Math.PI * time / profile.period, selectorY, center: x.slice(0, 2), frameAngle: x[2],
    finished: false, duration: profile.duration, loop: SELECTOR_RACK_LOOP};
}
