# Pass 88, lane p88-w: coincident water faces (432, 439, 463, 469, 473, 477)

Reviewers: Claude Opus 5.5. Lane p88-w made the first edits and stalled before its final test and review; lane p88-w2 finished the work. Date: 2026-09-27.

Scratch files and captures are in `/dev/shm/p87/p88-w2/`, outside Git; p88-w's own scratch is in `/dev/shm/p87/p88-w/`.

- **"Before" source.** Every before result comes from a HEAD snapshot (`83ac11f`) at `/dev/shm/p87/p88-w2/head/`. The snapshot is the working tree's `src`, `scripts`, `public` and `tests/helpers`, with every locally modified file replaced by `git show HEAD:path`.
- **Dev servers.** Two were used, both started by this lane: the working tree on port 45960 and the HEAD snapshot on port 45961.

## Coincident-face screen

`node scripts/screen-coincident-faces.mjs --ids=432,439,463,469,473,477` was run at the default 4 phases, and again at 16 and 32 phases for the final tree.

| ID | Before (HEAD): fights / seams | After: fights / seams |
|---|---|---|
| 432 | 2 / 0 | 0 / 0 |
| 439 | 4 / 1 | 0 / 0 |
| 463 | 5 / 2 (6 / 2 at 16 phases) | 0 / 0 |
| 469 | 1 / 0 | 0 / 0 |
| 473 | 3 / 3 | 0 / 0 |
| 477 | 1 / 1 | 0 / 0 |

No flags remain, so there are no false positives to explain. The files are:
- before: `before.json` and `before16.json`;
- after: `after-final.json`, `after16.json` and `after32.json`.

## Fixes

### 432: tail water against the wheel rims (`authored-breast-water-wheels.js`)
- **Problem.** The tail water's sides lay exactly on the rims' outer faces at z ±0.55. The rims showed speckle through the water.
- **Fix.** The tail water's half-width is now 0.565, so its sides stand 0.015 outside the rims. It still lies well inside the 0.9-wide masonry.

### 439: flume, groove, bucket pool and stream (`authored-water-bucket-reciprocators.js`)
- **Flume water.** The water sheet sank 0.01 into the trough's floor, side walls and closed end, and stops 0.01 short of the open lip. Its buried faces are hidden, and no face lies on a trough face. This removes the strong moiré in the trough.
- **Pulley groove.** The dark groove floor now sits in a 0.006 recess across the full floor width. Before, it was painted over the sheave's own floor face.
- **Bucket pool.** The pool's floor is raised to y −0.971, 0.009 above the bottom's top face and the seated valve disk's lower face. Its full surface stays at −0.20.
- **Stream.** The fall now plunges into the pool: by 0.02, or by half the depth of a shallow pool. Before, it ended exactly on the pool surface, which drew an internal water sheet.
  - Into a film less than 0.004 deep, the fall runs on to 0.002 above the bottom's top face instead. This stays clear of the film's floor, and 8-phase sampling showed the change was needed.
  - This last change is p88-w2's; the rest of 439 is p88-w's.

### 463: head, scour and tail water (`authored-self-acting-weirs.js`)
- **p88-w's changes:**
  - Every water face that meets a solid now stands 0.008 inside the water. These are the bed, the leaf faces, and the channel-wall planes at the leaf ends.
  - The brass contact strip is let into a rebate in the upper leaf plank, so the strip alone owns those faces.
  - The separate scour box was retired. Head, passage and tail are drawn as one closed section once the passage opens.
- **Bugs p88-w2 found in that version:**
  1. **Huge water spikes.** In the inset outline, two nearly parallel edges with different offsets meet far away. When the upper leaf stood a hair off upright, their meeting point ran out to y ≈ 15 000. Loop seams reported a 197 073% reshape at phase 0.89.
  2. **Self-intersecting outline.** At the moment of merging, the tilted bottom edge crossed the inset bed. The outline self-intersected, and the triangulator dropped triangles.
  3. **Pops.** The water popped as it switched meshes. The wedge between the leaves also appeared at full depth all at once, and so did the recess under the tilted lower leaf.
- **p88-w2's corrections:**
  - When a corner's miter would run beyond 4 × the inset, the corner moves by both edges' offsets instead. Fold-back wedges keep their true apex.
  - A wedge between the leaves that is too thin to hold water once inset is left dry. The water crosses its mouth at the lower leaf's top level, and the wedge fills from the mouth down as it opens.
  - The tail runs in under the tilted lower leaf's raised bottom edge, to where that edge's line meets the bed. The inset apex reaches the upstream corner just as the passage opens, so the passage opens into water already standing there. A recess too thin to hold water is left dry.
  - The joined section is used only when both inset passage corners clear the inset bed.
  - Head and tail are one mesh at all times: two closed prisms while the seated leaf parts them, one prism once the passage opens. The tail mesh is retired, like the scour mesh.
- **Checked over 20 000 phases:**
  - The section area varies smoothly; the largest step is 5.4e-4, compared with 0.14 in p88-w's version.
  - No cap triangle is inverted.
  - No vertex lies below the inset bed.
  - Loop seams report pop 0 at 960 steps.

### 469: axle end on the back wall (`authored-temperature-air-machines.js`)
- The wheel's stub axle ended flush with the back wall's outer face. Its back end now stops 0.04 inside the 0.14 wall, so the end cap is buried.

### 473: tub water (`water-sealed-pump-parts.js`)
- **Before.** Three volumes (the outer annulus, the pool under the rim and the inner column) plus two surface sheets shared faces, which drew internal sheets. All three lay on the tub floor.
- **After.** The water is one closed body of revolution.
  - It stands 0.007 above the tub floor and follows the barrel staves 0.005 inside, at 13 heights.
  - Only the vertices at the rim level and the internal level move.
  - The doubling surface sheets are removed.
  - `authored-water-sealed-air-pumps.js` still positions the detached `internalWaterSurface` object. This is harmless.

### 477: condensate (`authored-diaphragm-steam-traps.js`)
- The water sealing the seat bore and the pool on the seat are now one half-lathe. They previously shared the seat-top face and drew an internal sheet there.
- The film running down D starts 0.005 under the seat's lower face.
- The `condensateSeat` block is gone; `condensatePool` covers both regions.

## Other screens (HEAD → final)
- **Loop seams** (`--all`): 0 seams and 0 pops for all six, both before and after.
  - At `--steps=960`, 463 still reports 0.
  - At `--steps=960`, 439 reports a visibility pop of 1.05% at phase 0.652: the draining pool is hidden once its fill drops below 0.002.
  - HEAD shows the same 439 pop, at 1.04%, with the same visibility rule, so it is not new.
- **Disconnected parts:** the counts for detached parts, near-misses, open ends, slivers and lips are the same before and after for all six, and the per-item lists match apart from mesh indices. Only the mesh counts fall, because volumes were retired. The final tree has no slivers and no lips.
- **Body intersections:** the worst solid overlap is 0 in both. Open-mesh counts fall for 473 (2 → 0) and 477 (4 → 3).

## Captures
All are in `/dev/shm/p87/p88-w2/`.
- **Aimed captures.** `cmp/<ID>-<n>.png` holds one tile per flagged spot. Each tile shows before at zoom 5 and at zoom 15 rotated 6°, then after in the same two views. The single frames are in `aim-before/` and `aim-after/`.
  - **Speckle before, clean after:** 432-1/2 (rim through water), 439-1 (flume moiré), 439-2 (groove hatching), 439-3 (valve disk under the pool), 463-2/4 (the axle end's fan pattern through water), 463-3 (tail against the lower leaf, plus the scour box), and 473-1 (speckle on the water surface).
  - **Occluded:** 477-1/2 are hidden from the aimed angle, so they are covered by the screen and the section views.
- **Default, phase and rotated views.** Before and after are in `def/<ID>-*-{b,a}.png`, tiled as `cmp/def-<ID>.png` (before) and `cmp/def-<ID>-a.png` (after).
  - 463 zooms: the wedge (phase 0.35), the open scour (0.59) and the closing leaf (0.78).
  - Other tiles: `cmp/def-473-ba.png`, `cmp/def-477-ba.png`, `cmp/def-439-ba.png` and `cmp/def-432-469-ba.png`.
- **473 water with the tub and bell hidden:** `cmp/473-water.png`. The single body fills the annulus, the step under the rim and the inner column, with no internal sheets.
- **Water still fills its vessels and stays continuous:**
  - the 463 head water meets both leaves and the bed;
  - 463 scour water runs under the lifted leaf into the tail;
  - the 439 pool and trough are full;
  - the 432 tail pit is full;
  - the 477 seat pool is unchanged.

## Tests
Across the 19 targeted files below, 322 tests pass, 0 fail. Changes:
- **`tests/movement-463.test.mjs`:**
  - The tail and scour meshes are detached.
  - The one water mesh reaches the tail end.
  - The water has 2 connected pieces while the leaf is seated and 1 once the passage is open. Both states are sampled (phases 0/0.39/0.79 and 0.59).
  - The water bed stands 0.008 off the bed.
- **`tests/movement-473.test.mjs` and `tests/water-sealed-pump-solids.test.mjs`** (p88-w): the internal level is read from the one water body, and the body is resampled per pose.
- **`tests/water-mechanism-439-440-444-solids.test.mjs`:** the fall plunges into the pool, and the pool floor stands clear of the bucket bottom. This check fails at HEAD.
- **New file, `tests/water-coincident-faces-p88.test.mjs`:** runs the coincident-face screen at 8 phases on the production loader for all six IDs, and asserts 0 fights and 0 seams. It takes about 30 s.
- **The failing 439 test.** No 439 test failed against p88-w's final tree. The failure p88-w mentioned was not reproducible. The 8-phase screen test did catch the thin-film stream seam, and that is now fixed.

The 19 files: movement-432/439/463/469/473/477/464/474, temperature-air-469-bevel, thermal-steam-469-474-solids, water-mechanism-439-440-444-solids, water-sealed-pump-solids, water-wheel-430-432-solids, chain-weir-interfaces, models, reviewed-cycle-timing, ejector-trap-working-solids, screen-coincident-faces and water-coincident-faces-p88.

## Proposed ledger rows
The assessment stays `reasonable` and `visibleFlaws` stays empty for all six. Each fix removes a visible flicker; none introduces a flaw. Limits text to append:
- **432:** "Pass 88: the tail water stands 0.015 outside the rims' outer faces (no water face on a rim face)."
- **439:** "Pass 88: the trough water sinks 0.01 into the trough and stops short of its lip; the groove floor is recessed into the sheave; the pool floor stands 0.009 above the bottom and valve disk; the fall plunges into the pool (to just above the bottom through a film under 0.004)."
- **463:** "Pass 88: head, scour and tail water are one mesh (two bodies while the seated leaf parts them, one once the passage opens), inset 0.008 from the bed, leaves and channel-wall planes; thin wedges between the leaves and under the tilted lower leaf stay dry until they can hold the inset water; the brass strip is let into a rebate in the upper leaf."
- **469:** "Pass 88: the wheel's stub axle ends 0.04 inside the back wall."
- **473:** "Pass 88: the tub water is one closed body of revolution (annulus, under-rim pool and inner column) standing 0.007 above the tub floor and 0.005 inside the staves; only its rim and internal levels move."
- **477:** "Pass 88: the seat-bore water and the pool on the seat are one body; the film starts 0.005 under the seat."
