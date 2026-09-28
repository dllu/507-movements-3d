import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';
import {
  DEFAULT_DISPLAY_CYCLE_SECONDS,
  FINE_TOOTH_PASSING_RATES,
  MAX_DISPLAY_TOOTH_PASSING_RATE,
} from '../src/simulation/display-timing.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

// The fine-tooth gear demonstrations play slowly enough to follow the teeth:
// at most MAX_DISPLAY_TOOTH_PASSING_RATE teeth a second pass the mesh.
test('fine-tooth gear demonstrations cap the displayed tooth-passing rate', () => {
  assert.deepEqual([...FINE_TOOTH_PASSING_RATES.keys()], [24, 25, 26, 41, 42, 43, 44, 48, 53]);
  for (const [id, rate] of FINE_TOOTH_PASSING_RATES) {
    const timing = createMovementModel(catalog.movements[id - 1]).root.userData.animationTiming;
    assert.equal(timing.toothPassingRate, rate);
    assert.ok(Math.abs(timing.displayToothPassingRate - MAX_DISPLAY_TOOTH_PASSING_RATE) < 1e-9, `${id} at the cap`);
    assert.ok(timing.displayCycleDuration > DEFAULT_DISPLAY_CYCLE_SECONDS + 2, `${id} plays well above two seconds`);
    assert.ok(timing.displayCycleDuration < 8, `${id} still loops within eight seconds`);
  }
});

test('the tooth cap leaves other gear movements to the general timing rules', () => {
  for (const id of [27, 39, 40, 57, 414]) {
    const timing = createMovementModel(catalog.movements[id - 1]).root.userData.animationTiming;
    assert.equal(timing.toothPassingRate, undefined, `${id} is not capped`);
  }
});

// Tooth counts behind the authored rates: the fastest toothed rotor's teeth
// times its turns per authored second.
test('fine-tooth rates agree with the factories\' tooth counts', () => {
  const expectedTeeth = { 24: 30, 25: 36, 26: 28, 41: 28, 42: 40, 43: 44, 44: 36, 48: 16, 53: 40 };
  for (const [id, rate] of FINE_TOOTH_PASSING_RATES) {
    const model = createMovementModel(catalog.movements[id - 1]);
    const counts = [];
    model.root.traverse((object) => {
      const teeth = object.userData.teeth ?? object.userData.toothCount;
      if (typeof teeth === 'number') counts.push(teeth);
    });
    counts.push(...[model.root.userData.geometry?.teeth ?? []].flat());
    assert.ok(counts.includes(expectedTeeth[id]), `${id} has a ${expectedTeeth[id]}-tooth wheel`);
    const turnsPerSecond = rate / expectedTeeth[id];
    assert.ok(turnsPerSecond > 0.1 && turnsPerSecond < 0.3, `${id} wheel turns ${turnsPerSecond} per authored second`);
  }
});
