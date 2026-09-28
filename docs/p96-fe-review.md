# Pass 96 lane p96-fe: fixes for audit 341–425

Reviewer: Claude Opus 5.5, lane p96-fe (parent plus sub-lanes fe1–fe5). Date: 2026-09-28. Audit: docs/p96-audit-341-425.md. Captures: /dev/shm/p96/fe/. No git writes; the ledger is not edited.

## Lane parent (p96-fe): 376, 342 and quick lows

All captures are under `/dev/shm/p96/fe/<id>/`. The before captures are the audit's, in `/dev/shm/p96/e/tiles/<id>.png` and the `f*/` zooms.

### 376 (high): the axle impaled the horse
- **Verified:** the through axle (r 0.12, z −1.09…1.09) ran through the horse's body (z −0.27…0.33). The fixed bearings and standards are not presented, so nothing but the lattice bosses carried it.
- **Fix** (`authored-animal-treadwheels.js`):
  - The axle is now one overhung stub, `overhung-output-axle-stub-rigid-with-treadwheel`, at z 0.565…1.09. Its inner cap is buried 0.01 in the near (camera-side) boss, which reads as Brown's hatched section.
  - Both bosses are solid discs, so there is no bore showing daylight on the far face.
- **Low, also fixed:** each tread is now one channel extrusion, a board plus two end cheeks rising to r 2.055, with the cheek ends 0.005 inside the riveted bands. The 32 narrower bracket blocks and their 0.095 lips are gone (`treadMounts` is empty).
  - Not done: the round hoop behind each band stays. The lattice bars end in it.
- **Captures:** `376/after2.png` (d, T, L, R, B, side, Lp, zoom) and `376/Z3.png` (rear zoom).
- **Screens:**
  - Disconnected parts: 0 detached, 0 near-miss, 0 slivers, 0 lips.
  - Coincident faces: 0.
  - Body intersections: 0.
  - Loop seams: 0.
- **Tests:**
  - `movement-376`: new test that the stub starts inside the near boss and every horse part stays at z < stubInner − 0.1 over 17 poses. The role list is updated.
  - `treadwheel-working-solids`: the tread-to-band and tread-to-hoop joins are asserted and no mounts remain.

### 342 (low): square-cut beam end
- **Fix:** the beam's far end is a semicircular round end, within the same length (end x 6.8 source units). Brown's crop is not modelled.
- **Captures:** `342/after.png` (d, L, R, B, Lp, wide).
- **Screens:** unchanged (0 slivers, 0 lips, 0 coincident). No seams.
- **Tests:** `movement-342` and `beam-upright-solids` pass.

### Other quick lows
- **378:** the driving pin now starts 0.015 inside the pendulum rod's back face (z 0.29…0.66). It no longer leaves a 0.25 bare stub behind the pendulum.
  - Capture: `378/after.png`.
  - Tests: `movement-378` and `spring-pivot-family-solids` pass.
- **401:** removed the undrawn black stop block at the slide's end. Spring B's free position sets the rest, and the slot ends bound the travel.
  - Capture: `s4.png` (top row).
  - Tests: `dead-socket-cradle-solids` now asserts there is no stop, and `movement-401` passes.
- **409:** closed the pivot stack.
  - The collar sits on the washer (0.235…0.435) and the screw head on the collar (0.43…0.55).
  - The driver slot straddles the head's top face.
  - The axle ends inside the head at 0.52.
  - Capture: `s4.png` (bottom row).
  - Screen: near-misses fell from 15 to 13.
  - Tests: new stack test in `movement-409`; `drawing-gauge-solids` passes.
- **375:** the pan's centre bore is a blind socket. A floor closes it 0.002 below the shaft foot, so the background no longer shows through.
  - Capture: `375/after.png`.
  - Tests: `treadwheel-working-solids` asserts the floor.
- **425:** the neck steam stops 0.8 source units below the open mouths, so from above the ports read open instead of plugged.
  - Capture: `425/after.png`.
  - Tests: new test in `movement-425`.
  - The loop-seam pop at phase 0.5 is on the live crescent steam, which this change doesn't touch.
- **360:** the left cord runs on 0.88 below the ball's centre as Brown's hand-pull tail (it was 0.28). The ball keeps its heights, because the free length grows by the same 0.60.
  - Capture: `360/after.png`.
  - Tests: `movement-360` passes.
- **Screens for 360, 375, 378, 401, 409 and 425:** no new near-miss pairs against the audit's `disc.json`. The coincident-face flags are the audit's pre-existing 375 and 401 pairs, of area 1e−5 and 2e−7.
- **Bakes and reports:** no saved validation report or bake fingerprints any of these files.

## 348 and 350 (sub-lane fe1)

Scratch and captures are in `/dev/shm/p96/fe/348/` and `/dev/shm/p96/fe/350/`. Each has `before-*` and `after-*` files for these views: d, L, R, T, B, U and p1–p4. The composites are `tile-after.png` (plate plus 11 views) and `cmp-*.png` (before and after side by side).

### 348 (medium): crossed-slot disk A
- **Verified:** disk A was already one cross-holed extrusion. On top of it sat two overlapping recess boxes (`dark-recess-behind-through-slot-1/2`). Their top faces coincided where the slots cross, and their ends sat inside the slot ends. There were also four hidden groups of edge strips (eight boxes). That combination is what gave the stepped patch, the stray strips and the "chamfered" ends.
- **Fix:** `crossedSlotDiskGeometry(..., floorDepth)` in `src/simulation/authored-double-stroke-slots.js` now builds one watertight solid:
  - the plate's front cap and walls around the cross-shaped opening (two square-ended rectangles, unioned)
  - a plain 0.03 back plate
  - a cross-shaped groove floor triangulated on the hole's own corner vertices
- **Interior faces:** the interior caps are dropped, so no faces are coincident.
- **Floor shade:** the floor is a second material group at 0.8 of the disk colour, so it reads as a recess.
- **Removed:** the recess boxes and edge strips are deleted (`slotFloors = []`, `slotEdges = []`).
- **Clearance:** the slides (z ±0.075) clear the floor (z −0.09).
- **Result:** the body screen went from "open 1" (the first version) to "open 0". Coincident faces: 0. Disconnected: 0 detached, no slivers or lips; the three near-misses are pin and bore clearances. Loop seams: 0.
- **Captures:** `348/cmp-z.png` (no-rod zoom), `348/ns.png` (no shadow, front and oblique), `348/tile-after.png`.
- **Tests:**
  - `tests/movement-348.test.mjs` now asserts grooves with a floor, two material groups, and no floors or strips.
  - `tests/double-traverse-groove-solids.test.mjs`: the shoe is above the floor, and rays down through the shoe hit only the floor.
  - `p59` flat caps: passes.

### 350 (medium): pin D's guide rod floated
- **Fix:** each guide a now carries the rod (`inputRodHangers` in `src/simulation/authored-slotted-traverses.js`), with two parts per side:
  - **Hanger:** the upright continues down from its bottom face (y 0.876) as one flat L-plate (z −0.65…−0.21, behind the shoe, which stops at z −0.20), then turns outward to x ±3.04.
  - **Lug:** it closes over the rod end. Its front is a semicircle concentric with the rod (r 0.125), and it sits beyond the shoe's travel (|x| ≥ 2.899 against the shoe's 2.864).
- **Joints:** the hanger meets the upright face to face, and the lug meets the hanger face to face; adjacent coplanar faces meet without overlapping. Both parts are tagged `beyondPlateCrop`, and the camera fit bounds are unchanged.
- **Screens:** coincident faces 0 and body intersection 0. The rod-to-hanger "near-miss" (0.07) is the joint through the lug.
- **Captures:** `350/cmp-d.png`, `350/zooms.png` (right front, right rear, left from below), `350/tile-after.png`.
- **Test:** `double-traverse-groove-solids` asserts, at 65 phases, that:
  - the hanger is seated on its upright and lies behind the shoe
  - the lug is beyond the shoe and encloses each rod end
- **Low (bearing O floating), not fixed; I disagree with the auditor.** The "standard" that bearing O stands beside is Brown's broad standard on the output bar. It moves ±0.91 in x and sweeps directly behind the bearing (z −0.76…−0.58 against the bearing's −0.50…−0.12). A web in the standard's plane would tie a fixed bearing to a moving part. Any fixed support would have to arch over the standard's top (y 4.05), which is a large undrawn gantry. The screen still reports pin O, its cap and bearing O as one detached group. The existing documented limit stands.

## fe2: 355 and 358

Reviewer: Claude Opus 5.5, sub-lane p96-fe2. Files: `src/simulation/authored-gyroscopes.js`,
`src/simulation/gyroscope-working-parts.js` (claimed; 355/356 only),
`src/simulation/authored-fusee-traverses.js`, `src/simulation/cord-traverse-working-parts.js`
(claimed; shared with 352 and 362). Captures in `/dev/shm/p96/fe/355/` and `/dev/shm/p96/fe/358/`
(before: `/dev/shm/p96/e/tiles/355.png`, `f1/355-*.png`, `tiles/358.png`, `f2/358-crank-L.png`).

### 355 (medium, confirmed)

- Verified: p93 widened ring A's baked band out to r 1.93, but the ring stayed centred at the
  182 px rotor span (2.13), so its near edge sat 0.20 from the pintle axis, over the bearing cup
  (cup r 0.255, top 1.220; ring y 1.185–1.255). Neck F was a 0.357-long hook of r 0.105 whose end
  hung 0.07 below the 0.07-deep band as an open 12-sided stub.
- Plate: Brown leaves 40 px (0.468) from pintle F to the ring's near edge (ringLeft 149 − pivot 109),
  and F is a slender rod that rises from the pillar top, arches over and comes down to the ring.
- Fix: `supportToCenter = 40 px × 0.0117 + ringOuterRadius (1.93) = 2.398`, so the gap is Brown's.
  The auditor's "0.2 ring diameters" would be 0.77; the plate gives 0.47, which I used. Neck F is now
  one centripetal-spline tube (r 0.05, 128×24 segments) rising out of the pintle cap, arching to
  0.57 above the pivot and coming down vertically onto the top of the left spindle bearing. The band
  itself is bored for the spindle at that crossing, so the first attempt, landing on the band at
  r 0.535, sat in the bore (screen: open end, 0.039 gap); the bearing landing buries both ends.
  Swept bounds widened to ±5.0 and the phase-0 fit box to x 4.52.
- Numbers: ring clears the cup by ≥ 0.21 radially at all phases; the neck's lowest point is
  0.12 above the ring plane (inside the bearing wall, above the 0.096 bore).
- Screens: disconnected: 0 detached, 0 open ends, 0 slivers, 0 lips (was: 1 open end). The three
  near-misses are rotor/ring clearances and the neck end 0.03 above the spindle inside the bearing,
  which is hidden. Coincident: 0. Loop seams: 0.
- 356 is byte-identical: sha256 over all meshes' world matrices, attributes, indices and materials
  at two phases gives `e65649f4b3432a1e` for both HEAD and the working tree
  (`/dev/shm/p96/fe/hash.mjs`).
- Tests: `tests/movement-355.test.mjs` asserts Brown's 40 px gap, not the 182 px rotor span. A new
  pass-96 test covers ring/cup clearance over four phases, the buried neck ends, the bearing landing
  and the arch height. Two exact-zero turn-count tolerances became 1e-15 and 1e-14, because the new
  period is not float-exact.

### 358 (medium, confirmed; low closed)

- Verified: the crank hub sat against the fusee's large end (hub local y 2.13–2.25, face 1.69), on one
  ring bearing over a full cross bar. The shaft ended at 2.12, 0.01 short of the hub.
- Plate (0.0097 per px from the 177 px large diameter): the shaft runs from the large end through two
  bearing blocks, 21 px and 90 px out (0.21 and 0.87), to the crank at 132 px (1.28). The blocks sit on
  a box bracket off the lower long bar, whose top edge is 77 px (0.75) past the shaft. The auditor's
  "about 1.9 units" overstates it; the plate gives about 0.8 more than before.
- Fix:
  - Bearings at local y 1.90 and 2.56; crank hub at 2.97.
  - The shaft runs from −0.32 to the hub centre, so it enters the hub.
  - The two crank-end bearings are plain bored rectangular blocks (0.76 × 0.18, from the bracket to 0.16 above the axis), in the lighter `muted` grey so they read against the bracket.
  - Brown draws no full cross bar at the crank end, so it is replaced by one bracket plate. The plate runs from the lower long bar out to 0.75 past the shaft, and spans the two blocks (y 1.80–2.66).
- Residual: Brown's bracket outline continues under the crank. A solid plate there would lie in the
  crank's sweep (r 1.3), so ours stops 0.2 short of the crank plane. The cross bar's removal
  leaves the far long bar carried by the lower crossmember and the bed, as before at that end.
- 352 and 362 (sharing `cord-traverse-working-parts.js`) are byte-identical: `4d9f1a2c75bd8de1` and
  `3b397912ad2f55fb` at HEAD and in the working tree.
- Screens:
  - Disconnected: 0 detached, 0 open ends, 0 slivers, 0 lips. The 24 near-misses are the usual running clearances (27 before).
  - Coincident: the same two 1.9e-6 bed/side-bar pairs as the audit, dismissed there.
  - Loop seams: 0.
- Tests: a new pass-96 test in `tests/movement-358.test.mjs` checks:
  - the crank is 1.28 from the large end;
  - the shaft enters the hub;
  - there are two bored blocks on one bracket;
  - the blocks and bracket are clear of the crank plane.

## 361 and 398 (sub-lane fe3)

### 361 — lever stud (medium, fixed)
- Verified against mm_361.png: Brown draws the lever eye at the right upright's inner edge; the model put the dark stud (r 0.05, z -0.28..0.48) with its centre at x 1.275 on the post edge (post x 1.27..1.49), half its root in air, a bare 0.66 cantilever (edge ratio 0.1). Confirmed in `361/b-Rz.png`, `361/b-Lz.png`.
- Fix (`src/simulation/authored-axial-pin-clutches.js`): the pivot moves to the upright's centre line (x 1.38). The strap keeps its drawn world line because its offset is now derived (mid collar x - pivot x = -0.605). The stud is one turned lathe profile: a flange (r 0.095, sunk 0.02 into the face and inside the 0.22 post), a round standoff (r 0.07) clearing the shift collar, a slim journal (r 0.05) through the eye (bore 0.053), and a small head in front. The eye now sits over the post face instead of hanging off its edge.
- Captures (in /dev/shm/p96/fe/361/): before `b-tile.png`; after `a-tile.png` (default, yaw+50, zooms), `a2-Rz.png` (final flange), `a-phases.png` (phases 0.2/0.4/0.6 and top). The lever still swings the collar through the shift.
- Screens: edge-mounts 0 flagged (was ratio 0.1). Disconnected: 0 detached, near-miss only the hinge clearance at the eye (0.025). Coincident faces: the same 3 sheave/hub pairs inside the hub bore that the audit had already dismissed. Body intersections 0. Loop seams 0.
- Tests: `tests/movement-361.test.mjs` gains "361 lever stud is centred on the right upright face (pass 96)". The 361 file, one-way-clutch-working-solids and the 398/groove-drive tests all pass (24 + 12).
- Proposed row: assessment reasonable; visibleFlaws empty for this item. Append to limits: "Pass 96: the lever stud is a turned stud on the right upright's centre line (Brown draws the eye at the upright's edge); the strap keeps its drawn line."

### 398 — crosshead pin lug (medium, fixed)
- Verified: the rear crosshead block (box, local x 2.65..3.23) ended short of the rod pin at local x 3.279 (r 0.14), so more than half the pin and the rod eye overhung it (edge ratio -0.35). Confirmed in `398/b-tile.png` (zoom panels). In the plate, the pin sits on a small rounded end of the right-hand block.
- Fix (`src/simulation/authored-cam-rocking-drives.js`): the rear block is now one `plate` extrusion (z 0.27..0.63, same as before). Its outline is the block rectangle unioned with a neck and a round lug of r 0.224 (1.6 × pin radius), concentric with the pin. The front block is the same rectangle, now also a plate extrusion. The pin radius is shared as `pinRadius`.
- Captures (in /dev/shm/p96/fe/398/): before `b-tile.png`; after `a-tile.png`, `a-phases.png` (phases 0.2/0.4/0.6 plus an oblique), `a-lug.png` (lug with the rod hidden, underside, front and side).
- Screens: edge-mounts 0 flagged (was -0.35). Disconnected: 0 detached; the new near-miss "block / rod 0.03" is the running clearance between the rod eye (z 0.66) and the lug top (0.63). Coincident faces 0. Body intersections 0. Loop seams 0.
- Tests: `tests/movement-398.test.mjs` gains "398 rear crosshead block ends in a lug concentric with the rod pin (pass 96)". groove-drive-working-solids (includes the block-vs-guide clearance audit) passes.
- Proposed row: assessment unchanged apart from this item (the documented flaws the audit listed as still visible for 398 remain). Remove the pin-overhang flaw if the ledger lists it. Append to limits: "Pass 96: the rear crosshead block ends in a round lug concentric with the rod pin, in the block's own extrusion."

No saved validation report or bake fingerprints either file. Nothing deferred.

## 379 and 380 — cramp drills (sub-lane fe4)

File: `src/simulation/authored-cramp-drills.js` (claimed by p96-fe). Shared helpers
`turned-handle.js` and `drill-feed-parts.js` untouched (379/380 no longer call
`closeFeedThread`; `authored-joints.js` still does, unchanged).

### Plate check
- 379 (`mm_379.png`): under the spindle bearing Brown draws a thin collar and a
  flat spear drill (flared shank, waist, spear shoulder, point); no chuck block.
  The lower screw is hatched with fine lines rising to the right.
- 380 (`mm_380.png`): the hatched screw is ~0.45 of the nut's width; a block
  (chuck) sits under it and carries a spear drill. Hatching rises to the right.
- Both audit findings verified. Also found: the old helix was left-handed
  (front crests rising to the LEFT, labelled "right-hand"), mirrored against
  Brown's hatching. Fixed together with the thread.

### Fix
- New local `threadedTubeGeometry`: one closed solid, one material, V-thread
  (flat crest/root 1/8 lead, 3/8 flanks) on a helical grid whose rows follow the
  thread breaks, analytic normals, flat end caps; optional plain or threaded
  bore. Right-hand about +Y (front crests rise to the right, as Brown hatches).
- Kinematics sign flipped to match: advance = +lead x angle / 2pi
  (`threadAdvanceResidual` still 0; transmission law text updated).
- 379: screw root 0.135 / crest 0.18 (one blue solid from inside the handle
  boss to inside the rest; core + yellow ribbon removed); lead 0.28 -> 0.125,
  feed amplitude 1.25 -> 2.8 turns (travel 0.35 unchanged). The fixed nut is one
  solid with the matching internal V (0.005 radial clearance, phased to the
  screw's world helix); the square complementary nut thread is gone. Orange
  chuck + cone needle replaced by a thin dark collar (r 0.20, 0.07 thick,
  0.005 under the bearing) and a flat spear drill (0.785 long, 0.21 wide,
  0.06 thick). Spindle now ends inside the collar.
- 380: hollow screw is one solid: V root 0.165 / crest 0.20 (0.45 of the 0.88
  nut; was 0.64/0.88 = 0.73), bore 0.115 around the 0.09 spindle; lead 0.22 ->
  0.10, amplitude 1.25 -> 2.75 (down-feed 0.275 unchanged). Sleeve runs from
  inside the thrust collar to inside the handle hub, so the separate sleeve,
  yellow ribbon, two necks and two end rings are removed. Nut is one solid with
  internal V. Chuck shortened (0.35 -> 0.22) and seated 0.005 under the thrust
  collar (it is the lower thrust face; the lower thrust ring is removed); the
  upper thrust ring shrinks to r 0.11 inside the bore. Cone needle replaced by a
  flat spear drill (0.495 long, 0.17 wide, 0.055 thick). Spindle now ends inside
  the chuck (it used to poke 0.17 below it).
- Drill tips, clearances and cycle unchanged.

### Captures (`/dev/shm/p96/fe/`)
- `379/views.png`, `380/views.png`: plate, before default, after d/L/R/U/B/p2/p3.
- `fe4-screws.png`: screw zooms (front, yaw -45, from below into nut/handle).
- `fe4-bits.png`: spear bits front and side.
- `379/hatch.png`/`380/hatch.png` via `hatch.png`: plate hatching direction.

### Screens and tests
- `screen-disconnected-parts --ids=379,380`: detached 0, slivers 0, lips 0;
  near-misses are bore clearances only (JSON `fe4-disc.json`).
- `screen-coincident-faces --ids=379,380`: 0 flagged pairs (379 21k tris,
  380 27k tris).
- `check-loop-seams --ids=379,380`: 0 seams.
- `tests/movement-379.test.mjs`, `tests/movement-380.test.mjs`: 18/18 pass;
  updated for the sign flip, finer lead (three float tolerances scaled with the
  larger turn amplitude), removed blocks, and a new pass-96 test each (one
  single-material V-thread solid, fine lead, slim screw ratio, flat spear bit).
- No saved validation report fingerprints this file.

### Proposed ledger rows
- 379: assessment reasonable; visibleFlaws empty. Limits append: "Pass 96:
  feed screw is one single-material right-hand V-thread solid (lead 0.125,
  2.8-turn feed) running in a nut with the matching internal V; spear flat drill
  on a thin collar replaces the undrawn chuck and needle."
- 380: assessment reasonable; visibleFlaws empty. Limits append: "Pass 96:
  hollow feed screw is one single-material right-hand V-thread solid at 0.45 of
  the nut width (lead 0.10, 2.75-turn feed), bored for the spindle, in a nut
  with the matching internal V; the chuck bears on the thrust collar and carries
  a flat spear drill. The thrust collar plus chuck remain two blocks where Brown
  draws one (the collar is the reconstruction's axial capture)."
- tests/camera-catalog.test.mjs: pass.

## Sub-lane fe5: 397 and 407

Captures are in `/dev/shm/p96/fe/397/` and `/dev/shm/p96/fe/407/`. Each set has the default view, yaw ±50, top, behind, phases 0.2/0.4/0.6/0.8, Lp and zooms. Montages: `397/after.png`, `397/neckz.png`, `407/before.png` and `407/after.png`.

### 407: floating selected-arch curve and pencil (medium)

- **Plate check:** the auditor is right.
  - mm_407 draws only these parts: the jamb, the slotted base, the slide pin, the cord, the lath and a small tip collar.
  - It draws no arch curve and no drawing board.
  - The caption requires the pencil ("the pencil is secured to arched bar at its connection with cord").
- **Fix (`src/simulation/authored-pointed-arch-instruments.js`):**
  - Removed the red selected half-arch tube, the mirrored-half construction and the now-unused `lineTube` helper. The lath's own working edge is the template.
  - Kept the pencil, but its point now ends at z −0.19. That is the back plane of the base bar and the jamb, the wall face the instrument is laid against. Before, the point was 0.06 behind that plane in empty space (−0.26).
  - The barrel runs from −0.03 to 0.455 through the tip eye. The cone runs from −0.19 to −0.03.
  - With the red curve gone, nothing floats when the lath leaves the selected shape.
- **Not changed (low, deferred):** the bulky wound cord and the black thumb wing at the slide pin.
  - They are built in the shared `drawing-template-parts.js`, which 406 also uses and which is not claimed by this lane.
  - The winding carries the cord take-up (constant cord length), so a single loop would need a different take-up model.
- **Tests:** `tests/movement-407.test.mjs` now asserts:
  - there is no `selected-left-half-of-pointed-arch`
  - the pencil point's back face sits at z −0.19 (within 1e−12)

### 397: bare link pin, and the rocker's lower neck (documented lows)

- **Pin fix:**
  - The shuttle bar and lug moved from z 0.32 to 0.60. The bar now spans 0.46–0.74, directly behind the link (0.75–0.85), with a 0.01 gap to avoid coincident faces.
  - The slider pin was shortened to span 0.46–0.89.
  - The bare pin length between the lug and the link drops from 0.29 to 0.011.
  - Nothing else occupies the bar's height band: the rocker top is at y ≤ 1.97 against the bar's 2.07. The channel guide, rails and standards are removed by source-presentation, so moving them was not needed.
  - This takes out depth spread and adds no part.
- **Neck fix:**
  - The straight 0.26 capsule is replaced by Brown's broad S neck. Each side is one centripetal spline, traced from the plate in its upright rest pose (79.7 px/unit about the foot pivot) and turned by restLean into the rocker frame.
  - The neck waists to about 0.24 at mid-height and flares on both sides into the crescent's lower end. It is unioned with the crescent walls and the foot eye into one extrusion (no seam, no coplanar overlap). The pocket and the 0.144 bore are subtracted.
  - The upper arm is unchanged.
- **Screens:**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The near-miss list is:
    - link↔bar at 0.08: in-plane, not a joint
    - link↔lug bore clearance at 0.011
    - pre-existing rocker boss↔sill
    - crank arm↔rocker at 0.02 (moving clearance)
  - Coincident faces: 0.
  - Loop seams: 0.
- **Tests:** `movement-397`, `groove-drive-working-solids` and `drawing-template-working-solids` pass (19/19).

### Proposed ledger rows

- **397**
  - assessment: minor (unchanged, because the slot and crescent residuals remain)
  - visibleFlaws: "The slot's upper end runs about 8 px past Brown's stop. The crescent is a deeper arc than his, and its upper end curls about 12° further right."
  - limits:
    - Replace "About 0.29 of the link pin shows between the bar's lug and the link, which sits in the rocker's plane." with "p96: the shuttle bar and lug run directly behind the link (0.011 gap), so no bare pin shows."
    - Append: "p96: the lower neck is Brown's broad S (spline sides traced from the plate, waist about 0.24), one extrusion with the crescent walls."
- **407**
  - assessment: minor
  - visibleFlaws: "The cord winds as a bulky multi-turn knot with a black thumb wing on the slide pin, where Brown draws a single loop."
  - limits: append "p96: the undrawn red selected-arch curve is removed; the pencil point ends in the back plane of the bar and jamb (z −0.19). The cord still winds several turns on the slide peg with a small thumb wing (shared drawing-template-parts.js take-up), where Brown draws a single loop."
