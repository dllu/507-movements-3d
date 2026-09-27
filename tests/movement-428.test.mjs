import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredRubberLinedRotaryEngineMovement } from '../src/simulation/authored-rubber-lined-rotary-engines.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements.find((m) => m.id === 428);
const FULL_TURN = Math.PI * 2;

test('428: the rubber lining is a deforming mesh pressed in by steam against the rollers, and lies on the bore where exhausted', () => {
  const model = createAuthoredRubberLinedRotaryEngineMovement(movement);
  try {
    const u = model.root.userData;
    const g = u.geometry;
    const rubber = u.blocks.rubber;
    assert.ok(rubber.userData.deformingMesh);
    const rest = g.boreRadius - g.rubberThickness;
    let maximumInward = 0;
    for (let i = 0; i <= 96; i += 1) {
      model.update(i / 96 * u.animationTiming.authoredCyclePeriod);
      const state = u.stateAtTime(i / 96 * u.animationTiming.authoredCyclePeriod);
      const radii = u.innerRadiiAt(state.rotorAngle);
      // the rubber never enters a roller, and every roller pinches it on the bore
      for (const roller of state.rollers) {
        const [cx, cy] = roller.center;
        for (let k = 0; k < radii.length; k += 1) {
          const a = u.sampleAngles[k];
          const d = Math.hypot(radii[k] * Math.cos(a) - cx, radii[k] * Math.sin(a) - cy);
          assert.ok(d > g.rollerRadius - 0.006, `rubber inside roller at ${i}`);
        }
        assert.ok(Math.abs(Math.hypot(cx, cy) + g.rollerRadius - rest) < 1e-9, 'roller pinches rubber on the bore');
      }
      for (let k = 0; k < radii.length; k += 1) {
        assert.ok(radii[k] <= u.restRadii[k] + 1e-9, 'rubber never pulled off the bore outward');
        maximumInward = Math.max(maximumInward, u.restRadii[k] - radii[k]);
      }
      // every half has an admission space behind its first sealing roller
      const admissions = state.spans.filter((s) => s.kind === 'admission');
      assert.equal(admissions.length, 2);
      for (const span of admissions) assert.equal(span.pressure, 1);
    }
    assert.ok(maximumInward > 0.8, 'steam presses the rubber well in');
  } finally { disposeObject3D(model.root); }
});

test('428: steam enters by one channel of each neck behind the rollers and the space it fills grows as B turns clockwise', () => {
  const model = createAuthoredRubberLinedRotaryEngineMovement(movement);
  try {
    const u = model.root.userData;
    const period = u.animationTiming.authoredCyclePeriod;
    assert.ok(u.motion.rotorAngularSpeed < 0, 'clockwise, as Brown’s arrow');
    assert.ok(u.motion.rollerAngularSpeed > 0, 'rollers roll the other way');
    let previous = null;
    let grew = 0;
    let steps = 0;
    for (let i = 0; i <= 120; i += 1) {
      model.update(i / 120 * period);
      const admission = u.steamReport.spans.filter((s) => s.half === 'upper' && s.kind === 'admission');
      const upper = { to: Math.max(...admission.map((s) => s.to)), area: admission.reduce((sum, s) => sum + s.area, 0) };
      if (previous && upper.to > previous.to) { steps += 1; if (upper.area > previous.area - 1e-6) grew += 1; }
      previous = upper;
    }
    assert.ok(grew / steps > 0.95, 'the admission space expands while its roller advances');
    // loop seam: rotor, rollers (quadrant cue) and rubber repeat exactly
    const a = u.stateAtTime(0);
    const b = u.stateAtTime(period - 1e-9);
    assert.ok(Math.abs(THREE.MathUtils.euclideanModulo(a.rotorAngle - b.rotorAngle, FULL_TURN / 3)) < 1e-6
      || Math.abs(THREE.MathUtils.euclideanModulo(a.rotorAngle - b.rotorAngle, FULL_TURN / 3) - FULL_TURN / 3) < 1e-6);
    assert.equal(u.motion.rollerAngularSpeed * period % (Math.PI / 2) < 1e-9
      || Math.abs(u.motion.rollerAngularSpeed * period % (Math.PI / 2) - Math.PI / 2) < 1e-9, true);
    // Brown's pose: the upper-left and lower-right spaces are the steam spaces
    model.update(0);
    const spans = u.steamReport.spans;
    const pick = (half) => {
      const admission = spans.filter((s) => s.half === half && s.kind === 'admission');
      return { to: Math.max(...admission.map((s) => s.to)), area: admission.reduce((sum, s) => sum + s.area, 0) };
    };
    const upper = pick('upper');
    const lower = pick('lower');
    assert.ok(upper.to > 1.9 && upper.area > 3, 'upper-left space large');
    assert.ok(lower.to > 0.9 && lower.to < 1.2, 'lower-right space up to the bottom roller');
    const roles = [];
    model.root.traverse((o) => { if (o.userData.role) roles.push(o.userData.role); });
    for (const banned of [/foundation/, /marker/, /witness/, /indicator/]) assert.ok(!roles.some((r) => banned.test(r)), String(banned));
  } finally { disposeObject3D(model.root); }
});
