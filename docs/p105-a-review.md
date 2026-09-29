# Pass 105, lane a: 213 gaps, 326 crank pit, 460 pour

Lane p105-a (Claude Opus 5.5), 2026-09-29. The working tree is HEAD `06a498c` plus the other p105 lanes' uncommitted work. Vite ran on :46101. No git writes were made.

Captures are outside Git, under `/dev/shm/p105/a/`. Each `NNN-final-tile.png` shows the plate, then the default view, phase +0.33, yaw ±40 and pitch ±25.

## Files claimed

- `authored-intermittent-core.js`: claimed but not edited.
- `split-rim-213-contact.js` and its bake `baked/split-rim-213-contact.js`.
- `authored-steam-engine-guides.js`: used by 326 and 327. 327's code path is untouched, and its tests pass.
- `authored-bailing-scoops.js`: used only by 460.

No saved validation report fingerprints these files. `docs/validation/155-legacy-contact.json` names only `authored-intermittent.js`, which is unchanged.

## 213: the ring's gaps

**Verified against the plate first. The audit's direction is wrong.** Measured in plan (the bake outline, crossings at fixed radii), the old gaps were parallel-sided slots 0.282 wide. The teeth tapered from 0.175 at the root to 0.241 at the tips. So the gaps were wider than the teeth, not narrower: 1.61:1 at the root and 1.17:1 at the tips. The default view confirms this: a pixel scan along arcs at three radii gave gaps of 26 px against teeth of 20 px.

The audit's zoom (`/dev/shm/p104/c/213/z2.png`) was taken off-axis. There the 0.34-thick ring's tooth side walls hide part of each 0.28 gap.

Brown's castellations, scanned on the plate at the root arc, are about 1:1 with radial walls.

**Change:** `scripts/generate-split-rim-213-contact.mjs` now cuts radial-walled gaps. Before, it cut parallel-sided slots.
- **Gap angle:** the half-angle is solved as the least that lets the pin, at its closest approach, just meet both 0.008 top-corner fillets (the old width rule, applied to an angle). The result is 0.07665 rad.
- **Walls and fillets:** the fillets and the render widening (0.0006) follow the radial walls.
- **Root:** it stays flat at 1.55.
- **Bake:** the bake was regenerated with its script, and `--check` is byte-identical. It now also stores `slotHalfAngle`.
- **Note text:** the reconstruction note says "radial-walled gaps (1.17:1 …)".

**Result:**
- **Ratio:** gap:tooth is now a constant 1.17:1 at every radius. The root, which was 1.61:1, now reads square.
- **Default-view scan:** 24–25 px gaps against 21–22 px teeth.
- **Why not exactly 1:1:** the 0.156 face pin (asserted by the tests and matching Brown's drawn circle) needs a tip opening of 0.282. A 1:1 gap (0.263 at the tips) would clash with it at closest approach, and would need a pin radius of 0.145 or less.

**Tests:** `split-rim-213-contact` (6/6) and `movement-213` pass. A new test checks for radial walls: the gap angle is constant at R 1.6, 1.7 and 1.8, and gap:tooth is between 1.0 and 1.2. The contact figures:

| Quantity | Value |
|---|---|
| Minimum full-pin clearance | 6.6e-8 |
| Maximum working gap | 0.00056 |
| Rendered pin gap | 0.00028 |
| Driving moment | ≥ 1.585 |
| Largest playback step | 0.0155 |
| Reversal take-up | 0.000465 |
| Hysteresis | 0.0265 |

The five-index, reversal and rim-stop assertions are unchanged and pass.

**Captures:** `213-tile.png` (plate, before, after, zooms, rotated) and `213-final-tile.png`.

## 326: the open crank-pit tray

**Verified first.** The plate puts the crown 46 px below the shaft for a 56 px crank (0.82 crank radii). The canvas model's crown at −2.25 is 0.56 crank radii. So the crank dipped 0.50 below the crown, and the crank pit spanned 94% of the crown. The pit was cut through the whole cap depth, from the back plate to the rod slot, and the rod slot was open down into the hollow standard. Together they read as an open tray with thin rims (`326-bt.png`, `326-bu.png`), and the pillow block's front overhung the pit.

**Changes** (`authored-steam-engine-guides.js`):

1. **Crown lowered one source unit, to −3.25 (0.81 crank radii, as Brown draws it).**
   - The crown slab and the shoulder move down with it. The shoulder slides down the same straight taper, so it stays tangent.
   - The pillow block grows by the same amount, still one tangent-sided extrusion. Brown's block is tall.
   - The slot, stroke, rod, flywheel and every canvas landmark are unchanged.
   - The crank now dips 0.28 below the crown, not 0.50. The pit's half-chord at the crown is 0.77 against the hollow's 0.97, so the crown keeps 0.2-wide flat rims.
   - The rod's clearance to the side walls rises from 0.017 to 0.0995, because the shoulder follows the wider taper lower down.
2. **The cap is now a closed crown casting, from the back plate to the front skin.** It is one mesh, merged from three z-layers.
   - **Solid back:** the crown is solid from 0.18 to 0.315, under the pillow block (which ends at 0.31), so the block no longer overhangs.
   - **Crank pocket:** from 0.315 to the rod plane, the pocket's floor is the old concentric arc, 0.06 outside the crank's sweep.
   - **Rod fan:** in the rod's layer, the floor keeps open only the rod's own swept fan, 0.03 clear. The rest of the old full-width slot down into the standard is gone.
   - **Resulting pocket:** only as deep as the crank, pin and rod stack.

**Tests:** `movement-326`, `engines-326-345-clearance` and `engine-guide-solids` all pass (10/10 for 326; 327 is included). The cap test now asserts these points:
- The cap meets the skin, so there is no open tray.
- The pillow block sits wholly on the solid crown.
- The crank pin clears the pocket's back wall.
- The pocket is no deeper than the crank stack.
- The rod clears the crown casting at 48 phases, sampling 400 points along each shank edge. The minimum is 0.0304.

**Screens (326):**
- Coincident faces: 0.
- Disconnected parts: 0 detached. There are 39 near-misses and 4 short-of-pin, the same counts as HEAD.
- Body intersections: 0.0000 (only the sliding shoe contact).
- Loop seams: 0.

**Captures:** `326-atile.png` (default, oblique, and top views at phases 0, 0.5 and 0.75) and `326-final-tile.png`.

**Residual:** from above, the crank pocket is still a visible arc-floored recess, 0.6 deep and 1.5 wide. That is inherent: the crank dips below the crown, as Brown's proportions require. It now reads as a machined pocket in a solid crown, not a tray.

## 460: the edge-on pour

**Verified.**
- **Old sheet:** past the spout lip the discharge was a sheet 0.68 wide along z. The front camera sees it edge-on, so it was 0.24→0.08 thick in view (half-thickness 0.067→0.038).
- **Short fall:** the drop from lip to channel water is only about 0.3, as Brown draws the beak over the channel.
- **Pour window:** the stream was drawn back up the floor as the flow died, so it reached the channel in only 10.7% of the cycle.

**Changes** (`authored-bailing-scoops.js`):
1. **Round jet:** past the lip, Brown's beak gathers the sheet into a round jet of the same section area over the first 0.22 of the fall (`section` option of the shared `WaterStream`; the helper is unchanged). In view, the half-thickness at the bottom of the fall rises from 0.038 to 0.102, so the pour is about 2.7 times as thick from the plate's front view. The run inside the scoop is still the mouth-wide sheet.
2. **Pour timing:** once half the load has gone, the stream stays reaching the channel. Its tail then leaves the scoop and falls after it, instead of retracting up the floor. The pour now reaches the channel in 13.0% of the cycle (was 10.7%), 3 of 20 sampled phases. There is no end pop: the loop-seam check reports 0 pops. An intermediate version, which only held full reach, had popped 7.7% at 0.557.

**Camera:** not changed. The plate is a front elevation, and a round jet gains nothing from a yaw.

**Tests:** `movement-460` and `well-scoop-gutter-solids` pass.

**Screens (460):**
- Coincident faces: 0.
- Disconnected parts: no detachments.
- Body intersections: 0.
- Loop seams: 0.

**Captures:**
- `460-ba-zoom.png`: the lip at phase 0.48, before (left) and after (right).
- `460-atile.png`: phases 0.44, 0.48 and 0.53, and rotated views.
- `460-final-tile.png`.

**Residual:** at the default zoom the pour is still small, because the lip is only about 0.3 above the channel water (Brown's proportion). It now reads as a falling jet, not an edge-on sliver.

## Screens run

`screen-coincident-faces`, `screen-disconnected-parts`, `screen-body-intersections` and `check-loop-seams` were run for 213, 326 and 460. The outputs are in `/dev/shm/p105/a/{cf,disc,bi}.json`.

213 keeps its one documented detachment, the stop-ring arbor.
