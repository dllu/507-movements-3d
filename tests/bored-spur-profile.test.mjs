import assert from 'node:assert/strict';
import test from 'node:test';
import { boredSpurGeometry } from '../src/simulation/jaw-clutch-geometry.js';

test('shifted spur flanks follow the reference-circle involute after rack displacement', () => {
  const module = 0.096875;
  for (const options of [
    { teeth: 4, pressureAngle: Math.PI / 6, profileShift: 0.5, addendumCoefficient: 1 },
    { teeth: 16, pressureAngle: Math.PI / 9, profileShift: 0.3, addendumCoefficient: 1.3 },
  ]) {
    const geometry = boredSpurGeometry({ ...options, module, depth: 0.34, boreRadius: 0.04 });
    const { teeth, pressureAngle, profileShift } = options;
    const radius = teeth * module / 2, base = radius * Math.cos(pressureAngle);
    const involute = angle => Math.tan(angle) - angle;
    const referenceHalfWidth = Math.PI / (2 * teeth) + 2 * profileShift * Math.tan(pressureAngle) / teeth
      - module * 0.008 / (2 * radius);
    let checks = 0;
    for (const point of geometry.userData.outline.slice(0, 256)) {
      const r = point.length();
      // The generated root transition and trimmed top are not involutes.
      if (r <= base + 0.08 * module || r >= geometry.userData.outerRadius - 0.05 * module) continue;
      const expected = referenceHalfWidth + involute(pressureAngle) - involute(Math.acos(base / r));
      const error = r * Math.abs(Math.abs(Math.atan2(point.y, point.x)) - expected);
      assert.ok(error < 0.002 * module, `involute flank error ${error}`); checks += 1;
    }
    assert.ok(checks > 80, 'both working flanks are independently checked');
  }
});

test('a trimmed shifted pinion keeps its outside diameter and a continuous bored body', () => {
  const options = { teeth: 4, module: 0.096875, depth: 0.34, boreRadius: 0.04, pressureAngle: Math.PI / 6 };
  const plain = boredSpurGeometry(options), shifted = boredSpurGeometry({ ...options, profileShift: 0.5, addendumCoefficient: 1 });
  assert.equal(shifted.userData.pitchRadius, plain.userData.pitchRadius);
  assert.equal(shifted.userData.outerRadius, plain.userData.outerRadius);
  const minimum = Math.min(...shifted.userData.outline.map(v => v.length()));
  assert.ok(minimum > options.boreRadius + 0.07, 'the corrected root surrounds the bore');
  assert.ok(minimum > Math.min(...plain.userData.outline.map(v => v.length())), 'positive shift thickens the root');
  const tipWidth = shifted.userData.outline.filter(v => Math.abs(v.length() - shifted.userData.outerRadius) < 1e-10).length;
  assert.ok(tipWidth > 20, 'the trimmed tips retain finite width');
});
