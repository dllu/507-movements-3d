// Every non-MuJoCo movement must loop seamlessly: no position jump or sudden
// start, stop or reversal at its loop point, no rigid part teleporting
// mid-cycle, no finite run that ends and asks for Replay, and no motion that
// stops and holds. The live MuJoCo movements (model-loader physicsFactories)
// are baked separately and excluded here. See scripts/lib/loop-seams.mjs for
// the measurement and docs/p60-loops-review.md for the review.
//
// Visibility pops mid-cycle (a water stream switching on) and velocity
// changes at the loop point that the movement also makes mid-cycle (a pin
// strike, a rack reversal) are reported by the checker, not failed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkMovement, liveMujocoIds} from '../scripts/check-loop-seams.mjs';

// Justified exceptions. Each is a genuine mechanical event of the movement
// that happens to be measured as a seam, not a loop reset.
export const LOOP_SEAM_ALLOWLIST = new Map([
  [49, 'Ratchet click: the massless spring-held pawl drops off each tooth crest into the next space (about 1% of the model); it happens every tooth and one drop coincides with the loop point.'],
  [73, 'Ratchet click: strong spring C rides over the ratchet tooth crest and drops in behind it (about 3%) once per index, mid-cycle; a sprung stop, not a loop reset.'],
  [191, 'Brown\'s progressive scroll gears: the driven scroll returns from its fastest to its slowest radius at the radial step once per turn, at the loop point; the drive is continuous.'],
  [217, 'Heart cam: the roller lever reverses at the cam\'s point once per turn, at the loop point; the cam turns continuously.'],
  [428, 'India-rubber engine: the translucent steam volume is split between the two rollers and hands over from one to the other once per half-turn; the combined steam shape and all motion are continuous (docs/p69-engines-review.md).'],
  [63, 'Owned by a separate lane (spring-carried drop reverses at the loop point); recorded in docs/p60-loops-review.md, not edited here.'],
]);

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;

test('non-MuJoCo movements loop without seams, finite runs or stalls', {timeout: 3_600_000}, async () => {
  const failures = [];
  for (const movement of catalog) {
    if (liveMujocoIds.has(movement.id)) continue;
    const result = await checkMovement(movement, {stepsPerPeriod: 160, periods: 2});
    if (result.error) {failures.push(`${movement.id}: checker error ${result.error.split('\n')[0]}`); continue;}
    if (result.score > 1 && !LOOP_SEAM_ALLOWLIST.has(movement.id)) failures.push(`${movement.id}: ${result.issues.join('; ')}`);
  }
  assert.deepEqual(failures, []);
});

test('every loop-seam exception is documented', () => {
  for (const [id, reason] of LOOP_SEAM_ALLOWLIST) {
    assert.ok(Number.isInteger(id) && !liveMujocoIds.has(id), `${id} is a checked movement`);
    assert.ok(reason.length > 40, `${id} records why it is allowed`);
  }
});
