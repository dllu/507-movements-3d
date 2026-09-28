# Pass 91, lane w: no white parts

The rule (2026-09-28): avoid white parts. On the cream page (`PALETTE.paper`, #f3f0e9), white and near-white solids read as holes. For example, 77's lantern-wheel pegs looked like holes in the wheel.

Scratch files and captures are in `/dev/shm/p91/w/`, outside Git.

## Screen

`scripts/screen-white-parts.mjs` is new. It loads every production model through `model-loader.js`, as the browser does, reusing `loadProductionModel` from `screen-disconnected-parts.mjs`. It samples three phases and lists every visible mesh with any of these:
- a material colour with sRGB luminance above 0.8 and chroma below 0.16;
- an emissive colour meeting the same test;
- a textured material whose colour meets the test;
- a vertex-coloured material with more than 2% of sampled vertices meeting the test.

Each row records the role, colour, opacity and a coarse kind (fluid, glass, see-through, translucent or solid). Numbered roles are merged into one row: `wheelPinCap#`.

    node scripts/screen-white-parts.mjs [--ids=1-507] [--out=/dev/shm/p91/white.json] [--lum=0.8] [--chroma=0.16] [--jobs=12]

The whole run takes about 15 s with 12 jobs. The output is `/dev/shm/p91/white.json`; the before run is kept as `/dev/shm/p91/w/white-before.json`.

| | Movements with hits | Hit rows | Solid | Fluid | Translucent |
|---|---|---|---|---|---|
| Before | 87 | 201 | 142 | 58 | 1 |
| After | 26 | 71 | 12 | 58 | 1 |

## Recoloured

Only the named meshes were changed; no geometry changed. Two helpers in `source-presentation.js` and `authored-gears-core.js` hide index marks that are exactly `PALETTE.white`: `hideWhiteMarks` and `removeSourceAbsentIndices`. So shared `whiteMaterial` constants were left alone, and each part below got its own material. Recolouring a shared white material would have brought hidden index marks back.

| IDs | Part | Was | Now | File |
|---|---|---|---|---|
| 77 | 24 peg end caps | white | the peg's steel (`muted`) | alternating-peg-pawl.js |
| 12, 14–22, 247, 420 | figure's hand cuff | #e9e1d2 | linen tan #b9a88a | hauling-hand.js (shared) |
| 136, 145, 154, 164, 179, 225, 247, 419 (and every other `groundBlock` user) | ground, floor and foundation blocks | #e2ddd1 / #cfc9bb | stone #bfb6a0 / #a99f88 | ground-block.js (shared) |
| 156, 157 | crank-pin face disc | white | brass, like the pin | slotted-elbow.js, pinned-elbow.js |
| 201 | slot roller | white | brass | authored-gears-core.js |
| 208 | 48 axial drive pins | white | steel (the ink index pin stays) | authored-gears-core.js |
| 203 | slot follower pin | white | steel | authored-linkages.js |
| 246 | joint washers | white | brass | authored-drawing-instruments.js |
| 247 | sounding probe (stem, pad, foot, probe) | white | steel | authored-sounding-weights.js |
| 253 | framework A backing plate | #d8d2c4 | stone #bfb6a0 | authored-check-hooks.js |
| 292 | wheel studs | white | steel | authored-plate-escapements.js |
| 297 | lantern trundles (pins) | white | steel | authored-lantern-escapements.js |
| 300, 301 | spacer drum between the wheels | #e4ddcc | brass | authored-escapements.js |
| 306 | screw-head slots | white | steel | authored-three-legged-escapements.js |
| 307 | dead stops D and E, impulse pins | white | steel | authored-three-legged-escapements.js |
| 308 | pallet I plate and nib | white | steel | authored-detached-escapements.js |
| 311 | locking-stop faces D and E | white | steel | authored-gravity-escapements.js |
| 324, 325 | joint washers | white | brass | authored-compound-parallel-rulers.js |
| 332, 333, 335–340 | common working pins | white | ink, matching the family's other engines (upright, grasshopper) | marine, beam-engine, direct-action and vibrating-rod parallel-motion files |
| 342 | stay-end pins | white | ink | authored-atmospheric-beam-engines.js |
| 349 | pivot caps | white | steel | authored-jointed-parallel-rulers.js |
| 387 | post ball finials | white | brass | authored-tide-ladders.js |
| 396 | roller impulse pin | white | brass | authored-reed-escapements.js |
| 401 | faceplate guide pins, pitman–treadle pin | white | steel | authored-dead-center-cranks.js |
| 405, 406 | thread-end anchors, thread bight | white | the thread's ink | authored-parabola-drawing.js, authored-hyperbola-drawing.js |
| 409 | set-screw head | white | steel | authored-proportional-compasses.js |
| 415 | wheel D (see-through web, rim, hub) | #e0e1da | driven blue (still see-through) | authored-dickson-reversible-drives.js |
| 415 | lever input pin | white | steel | same |
| 416 | crank B pin, treadle joint pin | white | steel | authored-spring-assisted-treadles.js |
| 417 | lower swivel ball | white | brass | authored-bent-shaft-slides.js |
| 447 | two rope swivel balls | white | ink | reaction-ferry-parts.js |
| 452 | casing rear half behind the section | white | `muted` | authored-double-acting-pumps.js |
| 455 | case rear cover, rotor rear web | white | `muted` | authored-old-rotary-pumps.js |
| 471 | atmospheric hole e | white | ink, so it reads as an opening | authored-atmospheric-hammers.js |
| 481 | case rear head, drum head | paper | `muted` / stone | cutaway-presentations.js (`colors` in the 481 spec) |
| 483 | case back panel | paper | stone | authored-dry-gas-meters.js |
| 489 | control pins | white marker, opacity 0.96, no depth write | opaque steel | authored-feathering-paddle-wheels.js |

The colour choices follow the part's role:
- Steel is `PALETTE.muted`: used for pins and studs on warm-coloured parts and for pallets and stops.
- Brass is used for washers, rollers and finials, and where a pin sits on an ink or grey part.
- Ink is used where the family already draws its pins ink.
- Stone (#bfb6a0) is the new ground colour, reused for plain light back plates. It is not added to `PALETTE`: `primitives.js` is fingerprinted by about 30 validation reports and 7 bake provenance files, so it was not edited.

Some role names still contain "white", for example `…-white-joint-washer` and `white-crank-B-pin…`. They are historical; tests and presentations refer to them, so they were not renamed.

## Kept white (legitimate)

- **Paper and drawing boards:**
  - 152: drawing board under the ellipse.
  - 403, 405, 406: drawing boards. The screen classes these as fluid because the role names "traced-curve".
  - 411: ruled recording paper.
- **Dial faces:** 373 (spiral-spring indicator), 499 (dial plate and graduated arc), 500 (annular dial face).
- **Ivory scale boards:** 498 (scale board and its zero tag, which is part of the scale) and 501.
- **Steam:** 347 and 418–429, 470 and 474, drawn in the shared live/exhaust steam style.
- **Water:** splash and falling water in 430 and 433.
- **Hidden marks:** white index marks that the presentation layer already hides are not counted and were not touched.

## Deferred

350 has three white pins: `stationary-white-pin-in-upper-lever-slot-O`, `moving-white-pin-in-lower-lever-slot-D` and `shared-revolute-pin-lever-to-output-bar-at-C`. They are in `authored-slotted-traverses.js`, which lane p91-b has claimed, so they were not edited. The proposed fix is steel `muted`, or brass on the steel slide.

None of the other claimed IDs (80, 269, 270, 287, 320, 352, 391) had hits.

## Near-threshold (not changed)

A run with `--lum=0.7` (`/dev/shm/p91/w/white-lum070.json`) also lists light steel #c3c7c1 (luminance 0.775):
- 63: drop and stop pin;
- 181, 182: hinge pins and pivot heads.

It also lists light grey plates and walls:
- 46: root, #b6bebb;
- 185: #cfcabf;
- 318: scale plate;
- 370: mirror backing;
- 385: wall.

These are visibly grey, not white, and were left alone. Recheck them if the user reads them as holes.

## Captures

The before and after sets are in `/dev/shm/p91/w/before/` and `/dev/shm/p91/w/after/`. For all 72 IDs with non-fluid hits there are three views: `NNN-v0` (default view), `NNN-z` (2.2x zoom) and `NNN-r` (40° yaw, 20° pitch).

`/dev/shm/p91/w/cmp/NNN.png` puts the plate, the before zoom, the after zoom and the after default view side by side. There are sample sheets of five IDs each, `/dev/shm/p91/w/s1.png`–`s8.png`, covering these 40 IDs:

77, 12, 145, 201, 208, 253, 297, 300, 301, 307, 308, 311, 324, 333, 342, 349, 387, 401, 405, 406, 409, 415, 416, 417, 447, 452, 455, 471, 481, 483, 489, 156, 203, 246, 247, 292, 306, 336, 396, 419.

In 77's front view, the pegs now read as grey studs on the blue wheel rather than cream holes.

## Screens and tests

- **White screen:** 12 solid rows remain. All are in the kept list above, apart from 350, which is deferred.
- **Coincident faces:** run on all 72 IDs (`/dev/shm/p91/w/coincident-after.json`). 30 flagged pairs remain, in 136, 201, 208, 247, 401, 420, 430, 455 and 498. All of them are pre-existing: a HEAD copy made with `git archive` gives identical counts and areas (`/dev/shm/p91/w/coincident-head.json`).
- **Disconnected parts:** run on 77, 208, 297, 415, 481, 12, 201 and 253. The results are identical to HEAD, as expected for a colour-only change.
- **Loop seams:** 77, 208, 297, 415, 481 and 12 all pass.
- **Validation reports:** five reports fingerprinted a changed file and matched HEAD, so they were regenerated. Only their hashes changed; pose counts are unchanged and all results are clear.
  - `docs/validation/152-assembly.json`
  - `157-assembly.json`
  - `191-196-201-contact.json`
  - `200-226-bevel-solids.json`
  - `202-264-worm-solids.json`, run with `POSES=33` to keep 33 poses.

  These reports were already stale for the changed files before this pass and were not touched: 144, 145, 156, 205-208-209, and feed-worm-195/207.
- **Tests:** 88 test files, found through the changed modules, the movement tests for these IDs and the loader tests. Result: 787 pass, 0 fail (`/dev/shm/p91/w/tests.log`). No colour assertion needed changing.

## Proposed ledger rows

This is a colour-only change: no assessment changes. Append to the limits of each recoloured ID:

> p91-w: white/near-white parts recoloured (see docs/p91-w-review.md); no geometry change.

For 350, add to visibleFlaws:

> three white pins (O, D, C) read as holes on the page (deferred from p91-w: file claimed by p91-b).
