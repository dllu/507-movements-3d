import displayProfiles from '../data/display-profiles.js';
import { applySourcePresentation } from './source-presentation.js';

export const DEFAULT_DISPLAY_CYCLE_SECONDS = 2;
// Continuous gears remain trackable; brief escapement/indexing impulses may
// move faster without stretching every pendulum beat into tens of seconds.
export const MAX_DISPLAY_ANGULAR_SPEED = 6 * Math.PI;
export const MAX_SUSTAINED_DISPLAY_ANGULAR_SPEED = 2 * Math.PI;
// Fine-pitch gearing is hard to follow at low refresh rates even when the
// wheels turn slowly: what the eye tracks is teeth passing the mesh. Where
// applied, display playback keeps the tooth-passing frequency at the pitch
// circle (teeth per second past a fixed point) at or below this rate.
export const MAX_DISPLAY_TOOTH_PASSING_RATE = 6;
// Authored tooth-passing frequency (teeth per authored second) of the fastest
// toothed rotor, measured by scripts/inventory-rotating-parts.mjs and checked
// against each factory's tooth counts. The cap is applied only to these
// continuous fine-tooth gear demonstrations: applied to every toothed
// movement it would also stretch escapements, indexing trains and long
// clockwork cycles (for example 57, 260 and 414) to minutes, so it is opt-in.
export const FINE_TOOTH_PASSING_RATES = new Map([
  [24, 30 * 1.25 / (2 * Math.PI)],
  [25, 36 * 1.12 / (2 * Math.PI)],
  [26, 5.5259],
  [41, 4.5455],
  [42, 6.8755],
  [43, 7.4230],
  [44, 6.1879],
  [53, 6.6845],
]);

const OPENING_AUTHORED_CYCLE_PERIODS = new Map([
  [1, Math.PI * 2 / 1.55],
  [2, Math.PI * 2 / 1.55],
  [3, Math.PI * 2 / (0.8 / 0.74)],
  [4, Math.PI * 2 / (0.82 / 0.88)],
  [5, 10],
  [6, Math.PI * 2 / 1.05],
  [7, 16],
  [8, 16.8],
  [9, Math.PI * 2 / 0.5],
  [10, Math.PI * 2 / 0.5],
  [11, Math.PI * 2 / (0.82 / 0.76)],
  [12, Math.PI * 2 / 0.72],
  [13, Math.PI * 2 / 0.66],
  [14, Math.PI * 2 / 0.56],
  [15, Math.PI * 2 / 0.52],
  [16, Math.PI * 2 / 0.5],
  [17, Math.PI * 2 / 0.52],
  [18, Math.PI * 2 / 0.55],
  [19, Math.PI * 2 / 0.48],
  [20, Math.PI * 2 / 0.5],
  [21, Math.PI * 2 / 0.52],
  [22, Math.PI * 2 / 0.5],
  [23, Math.PI * 2 / 0.55],
  [24, Math.PI * 2 / 1.25],
  [25, Math.PI * 2 / 1.12],
  [26, Math.PI * 2 / 1.24],
  [27, Math.PI * 2 / 1.08],
  [28, 4.4 * 3],
  [29, Math.PI * 2 / 1.16],
  [30, Math.PI * 2 / 0.82],
  [31, Math.PI * 2 / 2.2],
  [32, Math.PI * 2 / 1.4],
  [33, Math.PI * 2 / 0.62],
  [34, Math.PI * 2 / 1.2],
  [35, 11.586015460047468],
  [38, 8.055365778435366],
  [43, Math.PI * 2 / 1.06],
  [50, Math.PI * 2 / 1.05],
]);

const CYCLE_PERIOD_PATHS = [
  ['timeline', 'demonstrationPeriod'],
  ['timeline', 'cycleDuration'],
  ['timeline', 'cyclePeriod'],
  ['timeline', 'balancePeriod'],
  ['canonicalTimes', 'cycleClosure'],
  ['motion', 'inputCycleDuration'],
  ['motion', 'cycleDuration'],
  ['motion', 'balancePeriod'],
  ['selector', 'cycleDuration'],
  ['transmission', 'cyclePeriod'],
  ['transmission', 'cycleDuration'],
  ['transmission', 'inputCyclePeriod'],
  ['transmission', 'inputPeriod'],
  ['geometry', 'cyclePeriod'],
  ['geometry', 'cycleDuration'],
  ['geometry', 'demonstrationPeriod'],
  ['geometry', 'speedCyclePeriod'],
  ['geometry', 'balancePeriod'],
  ['geometry', 'drumRotationPeriod'],
  ['geometry', 'operatingPeriod'],
  ['geometry', 'driverCyclePeriod'],
  ['geometry', 'wheelCyclePeriod'],
  ['geometry', 'lobeCyclePeriod'],
  ['geometry', 'eventPeriod'],
  ['geometry', 'orbitPeriod'],
  ['geometry', 'carrierCycleDuration'],
  ['geometry', 'adjustmentCyclePeriod'],
  ['geometry', 'inputCyclePeriod'],
  ['adjustmentSchedule', 'cycleDuration'],
  ['sourceAnimation', 'durationSeconds'],
  ['sourceAnimation', 'officialDurationSeconds'],
];

const ANGULAR_SPEED_KEYS = [
  'inputAngularSpeed',
  'driverAngularSpeed',
  'crankAngularSpeed',
  'pinionAngularSpeed',
  'wormAngularSpeed',
  'diskAngularSpeed',
  'spurAngularSpeed',
  'carrierAngularSpeed',
  'wheelAngularSpeed',
  'lowerAngularSpeed',
  'rightAngularSpeed',
  'drumAngularSpeed',
  'operatingAngularSpeed',
];

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function valueAtPath(object, path) {
  return path.reduce((value, key) => value?.[key], object);
}

export function authoredCyclePeriodFor(model, movement) {
  // Later authored models can declare the display loop directly. Preserve
  // that model-specific decision instead of replacing it with a heuristic.
  const explicitlyAuthoredPeriod = positiveFinite(
    model.root.userData.animationTiming?.authoredCyclePeriod,
  );
  if (explicitlyAuthoredPeriod) return explicitlyAuthoredPeriod;
  const openingPeriod = OPENING_AUTHORED_CYCLE_PERIODS.get(movement.id);
  if (openingPeriod) return openingPeriod;
  const data = model.root.userData;
  for (const path of CYCLE_PERIOD_PATHS) {
    const period = positiveFinite(valueAtPath(data, path));
    if (period) return period;
  }
  const cyclesPerSecond = positiveFinite(data.geometry?.cyclesPerSecond);
  if (cyclesPerSecond) return 1 / cyclesPerSecond;
  const cyclesPerMinute = positiveFinite(data.sourceAnimation?.cyclesPerMinute);
  if (cyclesPerMinute) return 60 / cyclesPerMinute;
  const inputFrequency = positiveFinite(Math.abs(data.geometry?.inputFrequency ?? 0));
  if (inputFrequency) return Math.PI * 2 / inputFrequency;
  const cycleRate = positiveFinite(Math.abs(data.geometry?.cycleRate ?? 0));
  if (cycleRate) return Math.PI * 2 / cycleRate;
  const speedSources = [data.kinematics, data.transmission, data.geometry];
  for (const source of speedSources) {
    for (const key of ANGULAR_SPEED_KEYS) {
      const angularSpeed = positiveFinite(Math.abs(source?.[key] ?? 0));
      if (angularSpeed) return Math.PI * 2 / angularSpeed;
    }
  }
  return Math.PI * 2;
}

export function applyDisplayTiming(
  model,
  movement,
  displayCycleSeconds = DEFAULT_DISPLAY_CYCLE_SECONDS,
) {
  applySourcePresentation(model, movement);
  const authoredCyclePeriod = authoredCyclePeriodFor(model, movement);
  const targetCycleDuration = positiveFinite(displayCycleSeconds)
    ?? DEFAULT_DISPLAY_CYCLE_SECONDS;
  const peakVisibleAngularSpeed = positiveFinite(
    displayProfiles.profiles[movement.id]?.peakVisibleAngularSpeed,
  ) ?? 0;
  const sustainedVisibleAngularSpeed = positiveFinite(
    displayProfiles.profiles[movement.id]?.sustainedVisibleAngularSpeed,
  ) ?? peakVisibleAngularSpeed;
  const toothPassingRate = FINE_TOOTH_PASSING_RATES.get(movement.id) ?? 0;
  // A model may author its playback rate outright where the speed caps would
  // defeat the demonstration: 264's common worm must spin fast (a motor-speed
  // blur) for the 100/101-tooth wheels' 1% difference to accumulate visibly.
  const authoredPlaybackTimeScale = positiveFinite(
    model.root.userData.authoredPlaybackTimeScale,
  );
  const playbackTimeScale = authoredPlaybackTimeScale ?? Math.min(
    authoredCyclePeriod / targetCycleDuration,
    // A brief intermittent index can be unreadable even when peak speed is
    // modest. An authored minimum keeps that working stroke visible.
    authoredCyclePeriod / (positiveFinite(model.root.userData.minimumDisplayCycleSeconds) ?? targetCycleDuration),
    peakVisibleAngularSpeed > 0 ? MAX_DISPLAY_ANGULAR_SPEED / peakVisibleAngularSpeed : Infinity,
    sustainedVisibleAngularSpeed > 0 ? MAX_SUSTAINED_DISPLAY_ANGULAR_SPEED / sustainedVisibleAngularSpeed : Infinity,
    toothPassingRate > 0 ? MAX_DISPLAY_TOOTH_PASSING_RATE / toothPassingRate : Infinity,
  );
  model.root.userData.animationTiming = {
    authoredCyclePeriod,
    playbackTimeScale,
    targetCycleDuration,
    displayCycleDuration: authoredCyclePeriod / playbackTimeScale,
    peakVisibleAngularSpeed,
    sustainedVisibleAngularSpeed,
    ...(toothPassingRate > 0 ? { toothPassingRate, displayToothPassingRate: toothPassingRate * playbackTimeScale } : {}),
  };
  model.root.userData.sampledFloorY = displayProfiles.profiles[movement.id]?.floorY;
  model.root.userData.sampledMotionBounds = displayProfiles.profiles[movement.id]?.motionBounds;
  return model;
}

