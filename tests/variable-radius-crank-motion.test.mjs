import assert from 'node:assert/strict';
import test from 'node:test';
import {variableRadiusCrankAtAngle, sourceVariableCrankGeometry} from '../src/simulation/variable-radius-crank-motion.js';

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

test('engraving dimensions close throughout the cycle and fit the three initial joints', () => {
  const g = sourceVariableCrankGeometry();
  for (let i = 0; i <= 1440; i++) {
    const s = variableRadiusCrankAtAngle(2 * Math.PI * i / 1440, g);
    assert.ok(Math.abs(Math.hypot(s.wrist[0] - g.rockerPivot[0], s.wrist[1] - g.rockerPivot[1]) - g.rockerLength) < 1e-12);
    assert.ok(s.slotRadius > .35 && s.slotRadius < 1.46);
  }
  const s = variableRadiusCrankAtAngle(g.phase, g);
  for (const [name, pixel] of [['auxiliaryPin', [310, 217]], ['slotPin', [123, 161]], ['wrist', [473, 263]]]) {
    const projected = [286 + s[name][0] / g.scale, 264 - s[name][1] / g.scale];
    assert.ok(Math.hypot(projected[0] - pixel[0], projected[1] - pixel[1]) < 1.6);
  }
});
