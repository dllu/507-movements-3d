import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMovementModel, applyDisplayTiming } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { MAX_SUSTAINED_DISPLAY_ANGULAR_SPEED } from '../src/simulation/display-timing.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[133];
// Pass 97: Brown's drum is an eight-beam cage and the rope lies on an octagon.
test('134 octagonal rope rides the beam noses, clears the end wheels and reads at display speed', () => {
  const model = createMovementModel(movement);
  const u = model.root.userData, g = u.geometry;
  try {
    for (let i = 0; i < 64; i += 1) {
      const { path } = u.stateAtDrumAngle(i * Math.PI / 128);
      // Chords: between noses the rope is straight; round each nose it bends
      // on the nose radius, so no chord is ever shorter than the beam spacing.
      const chord = 2 * g.beamNoseCenterRadius * Math.sin(Math.PI / 8);
      let longest = 0;
      for (let k = 1; k < path.points.length; k += 1) longest = Math.max(longest, path.points[k].distanceTo(path.points[k - 1]));
      assert.ok(longest > chord - 1e-9, 'straight chords between the beams');
      const count = path.exit.u - path.entry.u;
      assert.ok(count >= 7 && count <= 9, `wrap spans ${count} beam pitches`);
      for (const p of path.points.slice(1, -1)) {
        assert.ok(Math.abs(p.z) + g.ropeRadius < g.drumWidth / 2, 'rope between the end wheels');
        assert.ok(Math.hypot(p.x, p.y) - g.ropeRadius > g.frontRimOuterRadius, 'rope clears the front rim in the front view');
        assert.ok(Math.hypot(p.x, p.y) + g.ropeRadius < g.flangeOuterRadius + 1e-9, 'rope within the rear flange');
      }
    }
    applyDisplayTiming(model, movement);
    const timing = u.animationTiming;
    assert.ok(timing.sustainedVisibleAngularSpeed <= MAX_SUSTAINED_DISPLAY_ANGULAR_SPEED + 1e-9);
    assert.ok(u.hideGround && u.supportsRestart);
  } finally { disposeObject3D(model.root); }
});
