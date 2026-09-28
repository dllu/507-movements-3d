# Pass 96, lane p96-u: 72, 73, 80, 148 (user review)

- **Reviewer:** Claude Opus 5.5, lane p96-u. Date: 2026-09-28.
- **Captures:** under `/dev/shm/p96/u/` (outside Git). `before/NNN/tile.png` and `after/NNN/tile.png` show the plate beside the default view, yaw +50°/pitch 20°, yaw −50°/pitch −15°, back, top, and phases 0.33 and 0.66. Zooms are named below.
- **File claims (p96-u):** `crossed-rack*.js`, `crossed-rack-{profile,return,source}.js`, `tilt-hammer.js`, `tilt-hammer-{motion,profile}.js`, `geared-crank.js`, `geared-crank-source.js`, then (after p96-fa and p96-fb released them) `authored-intermittent-core.js`, `geared-crank-frame.js` and `display-profiles.js`.

## 80: flat hooked pawls, no protrusion
- **Why the old model had a step.** A hook that lifts a tooth from outside the rack has to cross the tooth line just above that tooth. When the pawls cross each other as Brown draws, each one comes from inside the rack. So a pawl lying in the plane of its teeth would cut through the teeth above the one it lifts, whatever plane is chosen for each rack edge or pawl. The rack rises about five pitches, so every tooth passes that crossing point. Giving each rack edge its own plane doesn't help: the crossing is always on the pawl's own tooth line. The only flat solution is the one the user offered: move the pivots so the paths don't cross.
- **Change.** Each pawl is now one flat plate, 0.10 deep, lying inside the rack's own thickness. It hangs beside its own toothed edge.
  - **Pivots:** on the lever, just outside the rack edges, at source (494, 287.4) and (746, 294.5). Brown draws the eyes there, but further out. The eyes clear the passing tooth tips.
  - **Outline** (`pawlOutline` in `crossed-rack-geometry.js`): a bored boss and a straight bar 16 px wide. The bar leans slightly outward so the pawl's centre of mass sits inboard of the pivot. At the bottom it turns into a wedge toe that fills the tooth space: the top bears on the tooth's flat underside with a 0.3 px gap, and the lower face lies 3 px off the next tooth's flank. The point stops about 4 px short of the root.
  - **Removed:** the hook webs, the pawl layers in front of the rack and the concealed toe relief. The pins stop inside the eyes, and nothing stands in front of a pawl. The part count went from 14 to 12.
- **Motion.** The lever amplitude is 0.22 (was 0.16), because the pivots are closer to the fulcrum.
  - The new `scripts/generate-crossed-rack-motion.mjs` bakes a quasi-static ratchet solved on the finite outlines:
    - The rack rests on the higher toe.
    - A pawl that isn't carrying hangs at its drawn angle, or swings out only as far as the teeth require (bisection).
    - The loaded pawl is held at its drawn angle by friction at the toe.
  - The rack rises exactly 2 pitches per lever cycle, with rollback at each handoff. It reaches 4.79 pitches at the end of the lift.
  - The return reuses the old three-second demonstration pattern: hooks swung clear, rack let down, lever brought to rest, hooks reseated. The 12 s loop closes exactly.
  - Largest sampled pawl/rack overlap over all 2401 rows: 1e-12.
- **Replaced files:**
  - `src/data/crossed-rack-profile.js` is regenerated in a new format.
  - `src/data/crossed-rack-return.js` and `scripts/generate-crossed-rack-return.mjs` are deleted (working tree only); the return is inside the new bake.
  - The old dynamics provenance (`artifacts/review/080-*`) no longer describes production.
- **Captures:** `after/080/tile.png`. `after/z80.png` shows the toe engagement from the front at three phases, plus an oblique view.
- **Screens:**
  - Disconnected parts: 0 detached. One near-miss: the fulcrum's running clearance in the slot, 0.032.
  - Coincident faces: 0.
  - Body intersections: worst 0.0000.
  - Seams: 0.
- **Tests:** `crossed-rack.test.mjs` passes 8/8. It was rewritten to assert one flat plate per pawl inside the rack's layer, no hook web or front cap, pivots outside their own tooth tips, 2.000 pitches per cycle, rollback, loaded-toe support and family clearance through the return.
- **Residuals:**
  - The pawls no longer cross as Brown draws.
  - Pawl mass, friction and impact are not simulated. The loaded pawl relies on toe friction, because the toe lies about 25 px inboard of the pivot.
  - The return is a demonstration.

## 148: the short link now drives a crank on the gear axle
- **Reading.** The caption says the gears produce "alternate circular motion of the crank attached to the larger gear". The groove on the gear's face still drives the long lever. Brown's short arm is now a separate link: it runs from the lever's pin to the eye of a crank pivoted on the large gear's own axle, in front of the gear. The rocking lever swings that crank to and fro, about 0.98 rad. Every drawn part is connected.
- **Why not a crank pin fixed on the gear.** A four-bar with its crank pin on the gear would conflict with the groove, which already sets the pin's path. A fit of such a four-bar's joint path to Brown's oblong, over crank, link, rocker and phase, was 19 px RMS at best, so the oblong can't be that path.
- **Geometry.**
  - The link and crank are both lengthened to 1.75. Brown's 1.41 and 1.58 can't follow the pin to the outer end of its swing (3.22 from the axle). This puts the eye 10 px left of and below where he draws it.
  - The crank is a plain bored plate with a hub boss on the gear shaft, which is extended to 0.316. It sits at z 0.24–0.32.
  - The link is at z 0.33–0.41, in front of everything.
  - The lever pin runs from the groove through the lever into the link's bore. Its old head is gone.
- **Validation:**
  - `docs/validation/148-frame-assembly.json`: 65 poses, 0 failing pairs.
  - `docs/validation/148-assembly.json`: 19 parts, 135 pairs, 0 failing.
  - `docs/validation/148-complete-teeth.json`: 257 poses, 0 overlap.
  - `148-rocking-frame.json` is a historical rejected study of a part that no longer exists, so it was not regenerated.
- **Captures:** `after/148/tile.png`. `after/z148.png` shows front views at phases 0 and 0.4 and two oblique views.
- **Screens:**
  - Disconnected parts: 0 detached. The near-misses are bore running clearances.
  - Coincident faces: 0, after the crank pin was sunk into the crank. The first run found the pin's back face flush with the crank's back face.
  - Seams: 0.
  - Body intersections: the screen reports 0.1066 on the legacy registry model's `short-rigid-crank…` part. That factory is not the browser's (`model-loader` uses `geared-crank.js`) and is unchanged.
- **Tests:** `geared-crank-frame.test.mjs` (4, one new) and `geared-crank.test.mjs` (2) pass. The new test checks that the link ends stay on both pins, the eye rides the crank, the lengths stay fixed and the crank swings.
- **Residuals:** the crank arm and its place on the axle are inferred, and the eye is 10 px from Brown's.

## 73: spring C bends naturally
- **Before.** Only the short end beyond the pressing web moved. It was translated rigidly by up to 0.18 like a flapping hinge, while the long leaf stayed frozen. Then it jumped back to its seat in one frame (radius 1.018 → 0.855 between two 0.01 s samples) (`before/s73.png`).
- **After.**
  - **Bending.** C bends as one leaf from its block. The new `ProppedLeafCurve` is the small-deflection shape of a beam clamped at the block, propped where B's nib bears on the web (found each frame), with the end lifted by A's tooth. The deep web is modelled 4× stiffer than the thin end. Slope is continuous at the prop, the web moves at most 0.055 (against 0.18 at the end), and the thin end takes most of the lift.
  - **Drop.** When A's crest leaves C's end, the end springs back into its seat over 0.1 s with a cosine (accelerating) ease, sliding down A's front face where it leans over the drop. The drop is checked clear of A at build time.
  - The nib paths and the press are unchanged.
- **Captures:** `after/s73.png` (8 frames through the index and drop), `after/c73.png` (centre lines, old against new), `after/073/tile.png`.
- **Screens:**
  - Body intersections: worst 0.0000.
  - Disconnected parts: 0 detached.
  - Coincident faces: 0.
  - Seams: 0.
- **Tests:** the movement 73 test in `models.test.mjs` passes. It now takes the stop-contact error only while C's end is seated, and checks that the end never jumps by more than 0.02 per 1/4000 turn, never enters A, drops over at least 30 samples, and that the web at 40% of its length moves gently (0.005–0.06).
- **Unrelated failure:** `movement-240.test.mjs` fails test 5 both with and without this change. It belongs to another lane's file.

## 72: the striker seats in the bloom's dip
- **Plate check.** The dip in the yellow bloom is as wide as the striker: it is the striker's seat. The old hammer came to rest on the dip's left step (restQ 0.068), with the striker hanging over an empty hollow.
- **Change.** The new `scripts/seat-tilt-hammer-striker.mjs` post-processes the audited export (re-runnable: the unseated outline and fall length are kept in `profile.seat`).
  - The dip becomes the striker's seat:
    - The walls are arcs concentric with the hammer pivot, 0.004 outside the striker's swing.
    - The floor is the striker's own lower outline at q = 0.08.
    - The old hollow below it is solid bloom.
  - The striker now lands flat on the floor at restQ = 0.0800, sunk about half its height below the rim, and the hammer body clears the rim.
  - The gravity fall is continued with the audited RK4 and mass to the new rest, and the cam entry is re-solved on the flank. Landing speed is 0.726 (was 0.672).
  - The bloom's plain-cut tail is now baked into the profile, and the load-time trim in `tilt-hammer.js` is removed.
- **Captures:** `after/072/tile.png`. `after/z72.png` shows the landed front and oblique views and the lifted view.
- **Screens:**
  - Coincident faces: 0.
  - Body intersections: worst 0.0000.
  - Seams: 0.
  - Disconnected parts: the cam is reported floating 0.0996 from the foundation. This is the unchanged cam and its rear bearing, not the seat.
- **Tests:** `tilt-hammer.test.mjs` passes 9/9. A new test checks that no hammer plate cuts the bloom at rest, only the striker meets it slightly lower, and the striker sits below the rim. The rest-angle and peak-speed bounds were updated.

## Display profiles
`node scripts/measure-display-profiles.mjs 72 73 80 148` was run. Only the 73 and 80 entries changed.
- **Loader/catalog tests:** authored-loader, camera-catalog, catalog, display-tooth-passing and opening-camera-motion pass (14/14).
