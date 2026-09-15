import assert from 'node:assert/strict';
import test from 'node:test';
import {linkedVariableCrankGeometry, linkedVariableCrankAtAngle} from '../src/simulation/linked-variable-crank-motion.js';

test('all five moving link lengths close through a complete revolution', () => {
  const g = linkedVariableCrankGeometry(), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let previous;
  for (let i = 0; i <= 1440; i++) {
    const s = linkedVariableCrankAtAngle(i * 2 * Math.PI / 1440, g);
    for (const [a, b, length] of [[s.auxiliaryPin, [0, 0], g.radius], [s.wrist, s.auxiliaryPin, g.rightSpan],
      [s.slotPin, s.auxiliaryPin, g.leftSpan], [s.mainPin, g.mainPivot, g.mainRadius], [s.mainPin, s.slotPin, g.linkLength],
      [s.wrist, g.rockerPivot, g.rockerLength]]) assert.ok(Math.abs(d(a, b) - length) < 1e-12);
    assert.ok(s.innerMargin > .13 && s.outerMargin > .57);
    if (previous) assert.ok(d(s.mainPin, previous.mainPin) < .03);
    previous = s;
  }
});

test('initial moving joints stay within four pixels of the engraving', () => {
  const g = linkedVariableCrankGeometry(), s = linkedVariableCrankAtAngle(g.phase, g);
  for (const [name, p] of [['auxiliaryPin', [251, 230]], ['wrist', [61, 286]], ['slotPin', [428, 172]], ['mainPin', [489, 218]]]) {
    assert.ok(Math.hypot(267 + s[name][0] / g.scale - p[0], 275 - s[name][1] / g.scale - p[1]) < 4);
  }
});

test('an unreachable added link raises an error', () => {
  const g = linkedVariableCrankGeometry();
  assert.throws(() => linkedVariableCrankAtAngle(g.phase, {...g, linkLength: .01}), RangeError);
});
