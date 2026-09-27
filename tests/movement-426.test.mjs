import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAuthoredRadialPistonRotaryEngineMovement } from '../src/simulation/authored-radial-piston-rotary-engines.js';
import { pointInMulti } from '../src/simulation/steam-section-kit.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements.find((m) => m.id === 426);

test('426: each neck has two channels, one either side of its abutment D', () => {
  const model = createAuthoredRadialPistonRotaryEngineMovement(movement);
  try {
    const g = model.root.userData.geometry;
    // left neck: straight upper channel and bent lower channel, separate in the neck
    assert.ok(pointInMulti([-6.8, 1.977], g.cavity) && pointInMulti([-6.8, 0.977], g.cavity));
    assert.ok(!pointInMulti([-6.8, 1.477], g.cavity), 'solid wall between the two left channels');
    assert.ok(pointInMulti([6.8, -1.977], g.cavity) && pointInMulti([6.8, -0.977], g.cavity));
    assert.ok(!pointInMulti([6.8, -1.477], g.cavity), 'solid wall between the two right channels');
    // the abutments close on the hub
    for (const angle of [170, 350]) {
      const a = angle * Math.PI / 180;
      assert.ok(!pointInMulti([4.08 * Math.cos(a), 4.08 * Math.sin(a)], g.cavity), `abutment at ${angle}`);
    }
  } finally { disposeObject3D(model.root); }
});

test('426: both pistons follow the wall and are driven at once by steam behind them', () => {
  const model = createAuthoredRadialPistonRotaryEngineMovement(movement);
  try {
    const u = model.root.userData;
    const g = u.geometry;
    assert.ok(u.motion.rotorAngularSpeed > 0, 'anticlockwise, as Brown’s arrows');
    let twoLive = 0;
    let frames = 0;
    let previousLive = null;
    let growing = 0;
    let growthSteps = 0;
    for (let i = 0; i < 128; i += 1) {
      model.update(i / 128 * u.animationTiming.authoredCyclePeriod);
      const state = u.stateAtTime(i / 128 * u.animationTiming.authoredCyclePeriod);
      for (const p of state.pistons) {
        assert.ok(p.tipCenterRadius >= g.hubRadius - g.pistonHalfWidth - 0.0031, 'tip never sinks into the hub');
        assert.ok(p.tipCenterRadius - g.pistonLength >= 1.0 - 1e-9, 'piston stays clear of the groove bottom');
        assert.ok(p.tipCenterRadius - g.pistonLength <= g.hubRadius - 0.5, 'piston stays well in its groove');
      }
      const pieces = u.steamReport.pieces;
      const live = pieces.filter((p) => p.behind && p.pressure === 1);
      frames += 1;
      if (live.length === 2) twoLive += 1;
      const liveArea = live.reduce((sum, p) => sum + p.area, 0);
      if (previousLive !== null && live.length === 2) { growthSteps += 1; if (liveArea > previousLive - 1e-6) growing += 1; }
      previousLive = live.length === 2 ? liveArea : null;
    }
    // While both pistons cross the abutments (about 23 of each 180 degrees)
    // each chamber is open from inlet to exhaust: the engine's dead point.
    assert.ok(twoLive / frames > 0.8, 'both pistons have steam behind them most of the time');
    // the induction channels always carry live steam, the eduction channels exhaust
    const channels = u.blocks.steamMeshes.filter((m) => /channel/.test(m.userData.role));
    assert.equal(channels.length, 4);
    for (const m of channels) assert.equal(m.userData.pressure, /induction/.test(m.userData.role) ? 1 : 0);
    assert.ok(growing / growthSteps > 0.95, 'the live spaces expand as the pistons advance');
    const roles = [];
    model.root.traverse((o) => { if (o.userData.role) roles.push(o.userData.role); });
    for (const banned of [/marker/, /indicator/, /foundation/]) assert.ok(!roles.some((r) => banned.test(r)), String(banned));
  } finally { disposeObject3D(model.root); }
});
