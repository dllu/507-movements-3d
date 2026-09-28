# Pass 92, lane p92-s: rope colour (253, 352, 405) and rod ends (132, 362)

Reviewer: Claude Opus 5.5, lane p92-s. Date: 2026-09-28.

These are the p92-r follow-ups (see `docs/p92-r-review.md`). Scratch files and captures are in `/dev/shm/p92/s/` (outside Git):
- `before/NNN/tile.png` and `after/NNN/tile.png`: the plate beside the default, ±50°, back and top views, and phases 0.33 and 0.66.
- `cmp-132.png` and `cmp-362.png`: zooms on the rod ends. The top row is before and the bottom row is after, in the front, +50°, −60° and back (or +90°/30°) views.
- `cmp-132-v0.png`: the plate, then before, after, and after at +50°.
- `ropes.png`: the default views of 253, 352 and 405, and 405 at +50°. Before is the top row, after the bottom row.

No git writes were made.

## Claims and routes

- **Claimed by p92-s:**
  - `authored-cranks.js` (132)
  - `authored-grooved-cylinder-traverses.js` (362)
  - `authored-check-hooks.js` (253)
  - `authored-redirected-windlasses.js` (352)
  - `authored-hyperbola-drawing.js` (405)

  Each is the file the production route loads (`authored-routes.js`). `model-loader.js` has no special case or physics/baked route for any of these IDs.
- **Deferred.** These files are still claimed by live pass-92 lanes; `/dev/shm/p91/claims` is empty.
  - 35: `authored-gears-core.js`, claimed by p92-g.
  - 185: `authored-locomotive-valve-gears.js`, claimed by p92-h.
  - 283: `authored-rack-pumps.js`, claimed by p92-h.

## 253, 352, 405: ropes in the shared hemp brown

- **253.** The hoisting rope's material is now `PALETTE.rope`; it was `0x3b3632`.
- **352.** The windlass rope (`makeDynamicMovingBelt`, laid) is now `color: PALETTE.rope`; it was `PALETTE.driven`. It now stands out against the blue moving sheave and the red barrels.
- **405.** The thread is now one `cordMaterial = matte(PALETTE.rope)`, used by:
  - both straight cord segments;
  - the wrap around the pencil (`hyperbola-finite-cord.js` takes `focusCord.material`, so that file needed no edit);
  - the knot at the rule's end;
  - the bight collar.

  All of these were the shared ink material, which also coloured the axle and pencil point. Those keep ink.
- **Captures:** `ropes.png`, and `before|after/{253,352,405}/tile.png`.

## 132: the hand lever is one turned rod

- **Cause.** The lever was a 0.17 × 0.20 box and the grip a 0.22 × 0.25 dark box. The grip ended in balls of r 0.13–0.14, which the box corners (0.131–0.167 from the ball centres) poked through.
- **Plate.** Brown draws a single round rod that swells gently toward a rounded end.
  - At raster x = 315 the rod's lines span rows 127–140, about 12 px across.
  - At x = 495 they span rows 125–146, about 19.5 px across.
  - There is no separate grip and no ball.
- **Change.** The lever is one `LatheGeometry` in the driver colour, rigid with the upper disk as before.
  - It is a cone from r 0.086 at its root (inside the neck, at radius 0.22) to r 0.156, closed by a hemisphere of r 0.156 whose tip is at Brown's handle length (3.728).
  - The dark box grip is removed (`blocks.handleGrip`, `geometry.handleGripLength`). `geometry.handleRootRadius` and `geometry.handleTipRadius` are exported instead.
  - A non-mesh `handLever.userData.endAnchor` marks the end point, which the tests use.
  - The lathe is centred on its mesh origin. The clearance test's OBB (three's `OBB.applyMatrix4` does not rotate the box centre) is therefore correct for it.
- **Captures:** `cmp-132.png` (end zoom, 4 views), `cmp-132-v0.png`, and `after/132/tile.png`.

## 362: the follower pin is round

- **Cause.** The pin was a 0.105-square box whose corners (0.074 from the tip centre) poked out of the rounded tip (0.060 × 0.084 ellipsoid).
- **Plate.** Brown draws a plain straight pin.
- **Change.** The pin is now a cylinder of r 0.0525, the same accent material and the same length, from 0.42 above the shaft down to the tip centre. Its section lies inside the tip's 0.060 and 0.084 semi-axes, so only the tip works in the groove, as before. The invisible `followerBridge` beam is unchanged.
- **Captures:** `cmp-362.png`, `after/362/tile.png`.

## Scans and screens

- **Ball-end scan** (`/dev/shm/p92/r/ballend.mjs`): 132 and 362 are no longer flagged.
- **Disconnected parts**, from a working-tree copy with the original five files (`disc-before.json`), then the change (`disc-after.json`, and `disc-after132.json` for the final 132):

| ID | Detached | Near-miss | Open ends | Slivers | Lips |
|---|---|---|---|---|---|
| 132 | 2 → 2 | 16 → 17 | 0 | 0 | 0 → 0 |
| 253 | 0 | 4 → 4 | 0 | 0 | 0 |
| 352 | 0 | 9 → 9 | 0 | 0 | 0 |
| 362 | 0 | 13 → 13 | 0 | 0 | 0 |
| 405 | 1 → 1 | 1 → 1 | 2 → 2 | 0 | 0 |

  - **132.** The two detached groups are the existing bed/anvil and frame groups. The new near-miss is the lever root against the upper shaft, a 0.030 gap. It lies wholly inside the bell's neck, which the rod is embedded in, so it cannot be seen. An intermediate capsule-over-rod version showed 1 lip; the final single lathe has none.
  - **405.** The detached part and the open ends are the existing traced-hyperbola tubes, unchanged.
- **Coincident faces:** 0 flagged pairs and 0 seams in all five, before and after.
- **Loop seams:** all five checked; 0 seams, 0 pops, 0 errors.

## Regenerated reports (only the `authored-cranks.js` hash changed; no pose or sample counts or values changed)

- `158-oracle-comparison` (`compare-source-treadle-oracle.mjs`)
- `159-source-clearance` (`review-cord-treadle-clearance.mjs`)
- `160-spatial-band` (`review-spatial-treadle-band.mjs`)
- `160-authored-review` (`review-spring-return-treadle.mjs`)
- `146-source-measurements` (`measure-framed-yoke.mjs`)
- `156-oracle-comparison` (`compare-slotted-elbow-oracle.mjs`)
- `157-oracle-comparison` (`compare-pinned-elbow-oracle.mjs`)

Notes:
- The last six already held an older hash (`3a87…`) before this lane.
- `140-dimensions` has a `sourceCommit` field and was left alone.
- The other four changed files are fingerprinted by no report or bake.

## Tests

- **Changed files, all passing (61/61):**
  - `toggle-press-{bores,clearance,frame,silhouette,sockets}`
  - `movement-362`, `cord-traverse-working-solids`
  - `movement-253`, `lifting-check-hook-working-parts`
  - `movement-352`, `windlass-*`, `rope-drum-hardware`
  - `movement-405`, `hyperbola-finite-cord`
- **Re-run after the final 132 change:** `toggle-press-*` 5/5.
- **`models.test.mjs`,** for the IDs in `authored-cranks.js`'s route (92–101, 131, 132, 140, 146, 156–160, 230, 231): 16/16.
- **Test edits:**
  - `toggle-press-clearance`:
    - asserts the lever is one `LatheGeometry` with a tip radius larger than its root, and no grip;
    - its sweep check now uses the lever alone;
    - its negative control (the mirrored rearward sweep hits a column) still fires.
  - `models.test.mjs`, movement 132: the two uses of `handLever.children[2]`, the old end joint, now use `handLever.userData.endAnchor`, which is the same point.
- **Routes:** `generate-authored-routes.mjs` gives an unchanged `authored-routes.js`; no factory IDs changed.

## Proposed ledger appends

- **132:**
  - Append: "Pass 92: hand lever is one turned rod in the driver colour, swelling from r 0.086 to a hemispherical end of r 0.156 as Brown draws it; the square bar and dark square grip, whose corners poked out of their end balls, are gone."
  - Assessment: no change from this item.
  - visibleFlaws: remove any rod-end or ball-corner entry.
- **362:**
  - Append: "Pass 92: follower pin is round (r 0.0525), inside its rounded groove tip; no box corners."
  - Assessment: no change.
- **253:** append "Pass 92: hoisting rope recoloured to the shared hemp brown." No assessment change.
- **352:** append "Pass 92: windlass rope recoloured to the shared hemp brown (was driven blue, the same as the moving sheave)." No assessment change.
- **405:** append "Pass 92: thread, its pencil wrap, knot and bight recoloured to the shared hemp brown (were ink)." No assessment change.

## Deferred or not fixed

- **35, 185, 283.** Their production files are claimed by p92-g/p92-h, so they are untouched:
  - 35: rope colour; the round band is in accent.
  - 185: the rocker links' r 0.075/0.085 balls are smaller than the 0.078–0.1 box corners.
  - 283: the rack bars' r 0.104 rounded ends against 0.192 box corners.
- **132 near-miss.** The lever root's 0.030 gap to the upper shaft is hidden inside the neck; it is left as is.
