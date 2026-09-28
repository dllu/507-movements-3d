import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULTS, screenModel } from '../scripts/screen-coincident-faces.mjs';
import { loadProductionModel } from '../scripts/screen-disconnected-parts.mjs';

// Pass 88: these movements' water, steam-trap condensate and the parts that
// fought with them were separated (fluid inset from its vessel faces, one
// closed volume per connected body, buried or recessed solid faces), so the
// coincident-face screen finds no fight and no internal fluid sheet.
for (const id of [432, 439, 463, 469, 473, 477]) {
  test(`${id} has no coincident-face fight or fluid seam`, async () => {
    const model = await loadProductionModel(id);
    const result = screenModel(model, id, { ...DEFAULTS, phases: 8 });
    const listed = [...result.pairs, ...result.seams].map((row) => `${row.kind ?? ''} ${row.parts.join(' | ')}`);
    assert.equal(result.flaggedPairs, 0, listed.join('\n'));
    assert.equal(result.seamPairs, 0, listed.join('\n'));
  });
}
