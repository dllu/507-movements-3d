import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {movementBatches, batchAssignments, expandIds} from '../scripts/lib/movement-batches.mjs';

test('every remaining movement has exactly one primary family and existing reuse candidates', async () => {
  const assignments = batchAssignments();
  assert.equal(assignments.size, 325);
  assert.deepEqual([...assignments.keys()].sort((a, b) => a - b), Array.from({length: 325}, (_, i) => i + 183));
  for (const path of new Set(movementBatches.flatMap(batch => batch.reuse))) {
    await access(new URL(`../src/simulation/${path}`, import.meta.url));
  }
});

test('range selection rejects malformed, reversed and out-of-catalog requests', () => {
  assert.deepEqual(expandIds('195,207,220,230-231,230'), [195,207,220,230,231]);
  for (const invalid of ['0', '508', '230-220', '195foo', '1-2-3', '']) assert.throws(() => expandIds(invalid));
});
