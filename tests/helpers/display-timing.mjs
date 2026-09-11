import assert from 'node:assert/strict';

export function assertReadableTiming(timing) {
  const scale = timing.playbackTimeScale;
  assert.ok(Number.isFinite(scale) && scale > 0);
  assert.ok(timing.displayCycleDuration >= 2 - 1e-9);
  assert.ok(Math.abs(timing.authoredCyclePeriod / scale - timing.displayCycleDuration) < 1e-9);
  assert.ok(timing.peakVisibleAngularSpeed * scale <= 6 * Math.PI + 1e-9,
    'short impulses stay within three revolutions per second');
  assert.ok(timing.sustainedVisibleAngularSpeed * scale <= 2 * Math.PI + 1e-9,
    'sustained rotation stays within one revolution per second');
}
