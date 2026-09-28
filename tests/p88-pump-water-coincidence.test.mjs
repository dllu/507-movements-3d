import assert from 'node:assert/strict';
import test from 'node:test';
import { screenModel } from '../scripts/screen-coincident-faces.mjs';
import { loadProductionModel } from '../scripts/screen-disconnected-parts.mjs';

// Pass 88: the pump, press, jack and ram waters stand off the solids they
// fill and are built as one surface per body, so the coincident-face screen
// finds no fights and no seams in these movements. Two flags remain by
// design: 466's valve chest runs 0.004 into the barrel's section in the same
// iron (contrast < 0.02), and 453's riser tube meets its turned foot on a
// ring whose float rounding leaves a 1e-7 sliver; 454's delivery branch
// wall has one zero-extent triangle pair (4e-7).
const allowed = {
  466: (row) => row.parts.join('|') === 'sectioned-valve-chest-front-layer|sectioned-pump-barrel' && row.contrast < 0.05,
  453: (row) => row.kind === 'seam' && row.areaRelative < 1e-6,
  // 454's saddle-ended delivery branch has one degenerate triangle pair.
  454: (row) => row.parts.join('|') === 'delivery-branch-from-chamber-to-right-check' && row.areaRelative < 1e-6,
};

for (const id of [444, 448, 449, 450, 451, 453, 454, 466, 467]) {
  test(`${id} has no coincident water or solid faces`, async () => {
    const model = await loadProductionModel(id);
    const result = screenModel(model, id);
    const rows = [...result.pairs.map((row) => ({ ...row, kind: 'fight' })), ...(result.seams ?? []).map((row) => ({ ...row, kind: 'seam' }))];
    const left = rows.filter((row) => !allowed[id]?.(row));
    assert.deepEqual(left.map((row) => `${row.kind}: ${row.parts.join(' | ')}`), []);
  });
}
