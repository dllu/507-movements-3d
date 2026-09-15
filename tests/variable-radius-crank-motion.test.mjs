import assert from 'node:assert/strict';
import test from 'node:test';
import {variableRadiusCrankAtAngle} from '../src/simulation/variable-radius-crank-motion.js';

test('finite power rocker and both pitman spans close throughout the cycle', () => {
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let previous;
  for (let i = 0; i <= 1440; i++) {
    const state = variableRadiusCrankAtAngle(2 * Math.PI * i / 1440);
    assert.ok(Math.abs(distance(state.wrist, [10, 30]) - 30) < 1e-12);
    assert.ok(Math.abs(distance(state.wrist, state.auxiliaryPin) - 10) < 1e-12);
    assert.ok(Math.abs(distance(state.slotPin, state.auxiliaryPin) - 10) < 1e-12);
    assert.ok(state.wrist[0] > 7 && state.wrist[0] < 13);
    if (previous) assert.ok(distance(state.wrist, previous.wrist) < .02);
    previous = state;
  }
});

test('impossible closure is rejected rather than flattened to a false pose', () => {
  assert.throws(() => variableRadiusCrankAtAngle(0, {rockerPivot: [100, 100]}), RangeError);
});
