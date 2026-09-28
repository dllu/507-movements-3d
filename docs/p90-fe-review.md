# Pass 90, lane p90-fe: fixes for audit 341–425

Reviewer: Claude Opus 5.5, lane p90-fe, with six forked sub-lanes: A (365, 352–360), B (396, 389–394), C (398, 362–371), D (372–383), E (384–401) and F (403–424), integrated here. Date: 2026-09-27. Source audit: `docs/p90-audit-341-425.md`. No git writes.

- **Captures** are in `/dev/shm/p90/fe/<sub-lane>/`, outside Git. Before captures are the auditor's, in `/dev/shm/p90/e/`.
- **Live-tree verification.** During the pass, another sub-lane's unfinished `reed-396-contact.js` broke registry loading for a while, so the sub-lanes first ran their tests in shadow copies. Once everything was integrated, I re-ran on the live tree:
  - All `movement-NNN` tests for the changed IDs (and 322/323/410, which share files) and the family solids/contact tests: 544/544 pass. That includes two 359 tests in `reciprocating-cord-working-solids` that failed on the first run and were then fixed.
  - `camera-catalog`, `source-presentation`, `authored-loader` and `catalog`: all pass except two failures in other lanes' movements: 377's camera fit and 172's source-presentation removal.
- **Display profiles.** `src/data/display-profiles.{json,js}` was re-measured for every changed ID (the claim was held briefly, then released).
- **Claims.** Every file this lane edited was claimed as p90-fe; no finding was deferred because of file ownership.

## Unresolved from the audit
- **396 layout (high):** the balance is still about 1.2 times the escape wheel, and its staff sits about 1 wheel radius from the wheel's. About 400 bake trials failed at the plate's spacing; see sub-lane B.
- **411 drive:** geometrically forced. Brown's drum-shaft pinion axis never meets the wheel axis.
- **360:** the pawl drops from each crest in one frame.
- **375:** the pinion ratio differs from the plate.
- **378:** the saw lifts out of its cut once per cycle.
- **385:** the door, wall and hinges are kept.
- **Low findings not done:** 343, 344/345, 351, 358, 387, 388, 397, 399, 405 (disputed) and 374's dotted wheel.


---

## p90-fe sub-lane A: 365 (high), 352, 353, 354, 355, 359, 360 (medium), lows 346, 350, 356

Captures are in /dev/shm/p90/fe/A/. The before set is the auditor's /dev/shm/p90/e/{cap,tiles,A}. The after set is `tile-<id>-after.png`: the plate plus default, ±50°/pitch, behind and phases 0.33/0.67. Zooms are `z<id>.png`.

Tests ran in a shadow tree (`synctest.sh`, with `reed-396-contact.js` pinned to HEAD) because sibling work in progress broke registry import.

### 365 (high): rod feed invisible (verified)
- **Change:**
  - The rod keeps the shared quadrant cue, now as a checker. Alternate bands of pitch `axialAdvancePerRollerTurn/6` have the cue turned a quarter turn. The band offset is a shader uniform driven by the exact axial displacement, so the stock stays one fixed solid and the feed shows.
  - The rod radius is now 2·R·sin15° = 0.243 (was 0.23, closer to the plate's 0.58 R). One roller turn is then exactly half a rod turn plus six bands, so the cue repeats at the loop seam.
  - Roller shafts went from r 0.09 to 0.16 (Brown's stub axles).
- **Tests:** movement-365 9/9, including a new feed-cue test.
- **Screens:** loop seams 0; coincident faces 0; disconnected parts clear.

### 352: sheave supports touching only the axle ends (verified)
- **Change:** each bracket arm ends in a bored eye (r 0.13, bore 0.067, 0.20 long) that wraps the rear end of the sheave axle. The axle is shortened to run from the eye to 0.03 proud of the sheave. `z352.png`.
- **Screens:** lips 0 (were 14–19 %); coincident faces 0.
- **Tests:** 8/8.

### 353: needle wipers (verified)
- **Change:** each wiper is a straight-flanked triangle (base 0.48 rad, about half R). Its radial leading working face steps back in Brown's barb below r 1.24, which is below the contact band (r ≥ 1.40, so the contact law is unchanged). The tail nose is now in the helve colour, not black.
- **Tests:** 8/8.
- **Residual:** the anvil is still a plain block.

### 354: rod ladder across the crosshead (verified)
- **Change:**
  - The groove is now blind: it is cut from the disk side into a back plate, and the two layers are merged with a 0.002 overlap.
  - The wrist ends 0.013 short of the floor; the cap, retainer strap and posts are gone.
  - One straight stem runs the full length on the crosshead's back face (lowerStem hidden).
  - The view is now Brown's own: presentation rotates the model a half turn about y. The disk (rim, hub, shaft) takes the standard see-through style, the raised rim is on the viewer's face, and the pose is mirrored so the wrist sits right of the shaft as on the plate.
- **Screens:** the shaft/hub coincident cap was fixed (the shaft ends 0.005 inside the hub), so coincident faces are 0.
- **Tests:** 7/7, updated for the blind groove and the presentation rotation.
- **Files:** also `src/data/source-presentation.js` (354 entry only).

### 355: disk C a plain slab (verified)
- **Change:**
  - C is lathed as a heavy rim (0.8 R–R, full 0.34 thick) with a 0.12 web and a bell hub flaring to 0.46 on the pintle side.
  - The pose precession angle is 0.08→0.8 and the camera (1,3.4,12), so the default view shows the bell face as on the plate.
- **Framing:** the whole-sweep framing is kept, so the default view is still small and off-centre. A precessing rotor needs its sweep.
- **Tests:** 7/7 (one tolerance 0→3e-14 for the new angle).

### 359: spindle too thin (verified)
- **Change:**
  - Cord-centre radius is 0.105→0.194, so the visible spindle is 0.157, 0.087 of the fly diameter as on the plate.
  - The top nut and anchor pin are hidden, and the hub and socket are 0.25.
  - The winding is 4π→7.0 rad and crossbarLowY −0.28→−0.40. The old 4π overran the cord length at this radius (a 0.149 per-frame pop was caught by the test); the maximum step is now under 0.024.
  - The sleeve in `reciprocating-cord-working-parts.js` now scales with the spindle; that is its 359 branch only.
- **Tests:** 7/7.

### 360: pawl, tooth count, flywheel (verified)
- **Change:**
  - The ratchet has 20 teeth (`oscillating-drum-contact.js`, pitch 2π/20, tip 0.38). It advances 7 teeth per oscillation, because 5 was infeasible for the capture law (the catch time collapses).
  - The pawl is a constant-width circular-arc hook (0.085 wide, sagitta 0.20 of the chord), bowed away from the ratchet, with its eye on the pin. The nose stops on the root circle. It is generated by `scripts/generate-oscillating-drum-pawl.mjs` and seats in the root: 47/512 seated samples, maximum lift 0.20.
  - The flywheel is the shared `makeSpokedWheel` (flat rim, four filleted flat spokes). The torus and rod spokes are hidden.
  - The ratchet rebuild, flywheel and spoke phase are done in `authored-oscillating-drum-ratchets.js` (`fitBrownRatchetAndFlywheel`); the shared `one-way-clutch-working-parts.js` is untouched.
- **Tests:** movement-360 8/8 and one-way-clutch-working-solids 9/9 (360 expectations updated to 7/20).
- **Screens:** loop seams 0.
- **Residuals:**
  - The pawl still snaps down from each crest in one frame. I tried a timed fall, but the hooked nose then strikes the next tooth, so the snap is physical at this overrun speed.
  - The flywheel's four spokes repeat every 5 oscillations (30 s), not every 12 s display cycle. That is invisible because the flywheel only advances.

## Lows done
- **350:** O's black front disc is seated 0.005 into the pin end (it was 0.0175 proud). Tests 8/8.
- **346:** the crosshead pin caps are in the pin's ink colour, not white. Tests 8/8. Bearing-face recess not needed (hidden).
- **356:** the lower trunnion bore is 0.081→0.0835, so the flagged coincident faces (contrast 0.55) are now 0. Tests 7/7.

## Not done (low, by choice)
- **343:** documented compromise.
- **344/345:** single crank web.
- **351:** chunkier teeth.
- **358:** two shaft collars.
- **360:** a pre-existing beam-pivot-upright lip (0.235 relative), which the auditor did not report.

## Validation reports
No docs/validation report fingerprints the files changed here (checked with grep).

## Body-intersection screen (bi.json)
- 346, 350, 353, 354, 356, 359 and 365 have no solid penetration.
- 355 has only the coaxial pintle-in-cup contact (0.0002).
- 360: the fixed beam-pivot upright and the frame brace pass through the flywheel's sweep (coaxial 0.115 and 0.07). This predates this pass: HEAD shows the same 0.115 against the old torus rim. It is a real visible flaw that the auditor did not report, and it is not fixed here. The fix is to move the flywheel plane behind the frame, which also means extending the hub and shaft.
- 352: the screen ran out of heap on the 1024-segment laid rope. The disconnected-parts and coincident-faces screens are clean.

### 360 follow-up: frame through the flywheel (fixed)
- **Change** (in `fitBrownRatchetAndFlywheel`):
  - The spoked flywheel now turns at z −0.86, behind the rear shaft-bearing post (z −0.73..−0.51). It was at −0.27, where it swept through the upright (−0.51..−0.17) and the braces. As on the plate, the upright and brace now stand in front of the wheel.
  - The wheel is bored 0.102 and keyed on the shaft. The existing shaft is lengthened to z −0.95..0.76. No new parts were added.
- **Captures:** `tile-360-after.png` and `z360b.png` (rotated, behind and oblique).
- **Screens:**
  - Body intersections: the flywheel/frame pairs are gone. The remaining coaxial pairs (0.099 shaft in the rear post, 0.094 beam hub on its pin) are journals.
  - Coincident faces: 0.
  - Disconnected parts: no detached parts. There are 5 near-miss pairs, including the rear post and hub. The 0.235 lip is still there.
  - Loop seams: the crest-snap jump (0.87 % at t 33.9) is still flagged. The screen flagged it on some runs and not others. It is the documented one-frame pawl drop.
- **Tests:** movement-360 8/8 and one-way-clutch-working-solids 9/9.
- **Not done:** the 0.235 upright/pivot-pin lip. It is makeBeam's end-sphere joint at the pivot. Removing it needs a bored upright head, which is more than a cheap fix.

### 359 follow-up: reciprocating-cord-working-solids in the live tree
- **Fix:** connectorDrop is now 0.09→0.16 in `authored-pump-drills.js`. With the thicker spindle, the eye-to-helix bend of the laid rope had become sharp enough to break the rope solid's inside test, which gave a false "−0.04" cord/cord penetration at y 2.28. The centrelines stay ≥ 0.236 apart.
- **Test:** the sleeve-bore test now probes relative to `geometry.spindleRadius`; it was hard-coded at 0.15, which now lies inside the widened 0.161 bore. Only the 359 lines were touched.
- **Results (live tree):** reciprocating-cord-working-solids 8/8 and movement-359 7/7.
- **Recaptured:** `tile-359-after.png` and `z359.png`.

---

## p90-fe sub-lane B: 396, 389, 391, 392 (+ lows 393, 394)

Captures in /dev/shm/p90/fe/B/: tile-a-<id>.png (plate + d, r1, r2, b, p1), a-<id>-{d,r1,r2,b,p1,p2,z*}.png, zoom strips a-<id>-zz.png. Before captures: /dev/shm/p90/e/cap and tiles.
Screens (389 391 392 393 394 396): disconnected-parts disc*.json, coincident-faces cf*.json (0 flagged after fixes), body-intersections bi.log, loop seams 0/6.
Tests: movement-389, jack-389-contact, movement-391, weighted-rack-* (2), movement-392, movement-393, movement-394, movement-396, reed-396-working-parts: 75/75 pass. Camera-fit catalog check restricted to these IDs passes (the full catalog test stops at 377, another lane's movement). `generate-reed-396-contact.mjs --check` passes after regeneration.

### 396 (high)
- Floating fork: agreed. Lever C (fork e, straight arm with half-round crook d round staff a, boss on staff c, tail with a flat hand end) is now one flat plate extrusion. Plate reading: the lever runs behind the wheel (dotted behind h, visible through the crossing), so it moved to z -0.42..-0.30; roller h, pin i, guard pin, banking pins and balance rim re-layered (rim -0.62..-0.46) with front staff stubs shortened. Fork near-miss gone.
- Teeth: raked ratchet teeth (near-radial locking face, sloping back to 0.45 pitch, root 1.52); crossing is one broad three-armed plate (arc bands widening outward) unioned with the rim as one extrusion. Contact bake regenerated (4433 samples, one pitch per cycle); all finite-contact tests pass.
- Layout (balance 1.18x wheel, staffs 1.04 radii apart): NOT fixed. Tried the plate layout (balance staff -3.66, J arm 1.98, pin orbit 0.7) and intermediate distances in ~400 offline bake runs: at the plate's distance pallet j's path across the tooth circle is nearly straight, so it either collides with a locked tooth on the return swing or never receives the direct impulse. Also found: with the wheel clockwise and j at the wheel's left, a genuine direct impulse can only assist the balance on the swing where the model gives the lever impulse; the half-beat roles and pallet lock angles would need redesigning (lock angles so a tooth gap sits on the line of centres on the free pass). That is a new escapement reconstruction, left open.
### 389 (medium)
Agreed. The cast stand is now one hollow column: a back wall joining both sectioned walls behind the rack, rising past the right wall as one bracket bored for the eccentric shaft and stop pin. Undrawn spine, bridges and journals removed. No coincident faces (back wall inset 0.01 at the rear, 0.002 at the ground). Base steps: the model already has Brown's two ledges (447, 460 px); left as is.
### 391 (medium)
Agreed. Lever C widened to Brown's proportion (half-width 0.085 vs rack 0.16; short arm 0.07; boss 0.16). Pivot pin now runs back to a small lug on the back of guide b (behind its groove floor, clear of A1's guide pin; body screen confirms). Low: guide and weight arms are single rounded-end flat bars (degenerate sphere caps gone). Remaining body-screen contact 0.018 is spring d's hook on its stud (attachment).
### 392 (medium)
Agreed. Crank is a distinct lever plate on the flywheel's front face (bosses at both ends, tapering flanks); the throw box is hidden; crank pin now runs from the crank to the rod eye's front face only (was 0.46 behind the wheel). Lower guide cheeks rise to the table underside. Low: duplicate spokes removed (2 full-diameter bars) and spokes no deeper than the rim (lip gone). Not done: spring clamp block with two screws.
### 393 (low)
Carrier is one constant-section bent strap (square tail, rounded bends) replacing two boxes plus tail. Not done: bolder socket knob (ball size lives in shared polishing-joint-parts.js).
### 394 (low)
Rod end is now a flat rectangular crosshead block. Rod thickness left. Note: scripts/generate-reversing-transmission-profiles.mjs is already broken at HEAD (blocks.outputRotor undefined), unrelated to this change.
## Not done (low): 387, 388, 397 (documented trade-off), 399 (round-ended nut frames would leave no room for the bored end bars).

---

## Sub-lane p90-fe-C: 398, 362, 366, 367, 371

Reviewer: Claude Opus 5.5, sub-lane p90-fe-C of lane p90-fe. Date: 2026-09-27.

- **Scratch and captures:** `/dev/shm/p90/fe/C/` (outside Git). Before captures are the audit's `/dev/shm/p90/e/{cap,tiles,B,C}/`, plus `b398-*.png`. After captures are named `a<ID>-*`:
  - `-tile`: plate, default, rotated and behind
  - `-zm*`: zooms
- **Server and loader:** the captures used a private vite server on port 45103, stopped at the end.
  - While lane p90-fe-B's in-progress `reed-396-contact.js` stopped `registry.js` from loading, the tests and the body screen ran with `--experimental-loader /dev/shm/p90/fe/C/stub-loader.mjs`.
  - That loader stubs only the 396 factory. It does not touch any of these five movements.
- **Files changed:**
  - `src/simulation/authored-cam-rocking-drives.js`
  - `src/simulation/authored-grooved-cylinder-traverses.js`
  - `src/simulation/authored-treadle-drills.js`
  - `src/simulation/authored-parallel-rulers.js`: only the 367 function changed. 322 and 323 hash identically before and after (see 367).
  - `src/simulation/authored-mangle-wheels.js`
  - Tests: `movement-398`, `movement-366`, `drill-feed-solids`, `movement-371` and `reversing-transmission-working-solids`.
- **Shared helpers:** none were edited. `cord-traverse-working-parts.js` and `reversing-transmission-*` were left alone; the changes override their output inside the owning file.

### 398 (high): cam groove
- **Verdict:** confirmed, and the cause is different from the audit's reading.
  - The walls already were exact ±(roller radius) offsets.
  - The wobble was in the centreline itself. It came from the speed-varying law `g(f)`, where `unevenness` = 0.8 put S-bends in every flank.
  - Wall shadows on a floor the same colour as the lands made the groove width look as if it varied from 1 to 3 diameters.
- **Change:**
  - **Centreline:** now prescribed directly as an analytic three-lobed polar curve, `rho = d(pi) + 2r[1 - (a s + (1-a) s^2)]` with `s = (1 - cos 3psi)/2` and `a = 1.75`. The wheel angle is the exact inverse of the in-line slider-crank (bisection), so it stays monotone, one turn per side and three per cam turn.
  - **Value of `a`:** 1.75 matches Brown's trefoil (`cmp2.png`: plate, `a` = 1.6, `a` = 1.75). It is the largest value that keeps exactly one concave run per flank; `a` ≥ 1.8 re-introduces the wobble (`cmp.png`).
  - **Floor:** the groove floor band is its own full-depth plate, whose front face uses a 0.72× shade of the cam colour, so the constant-width channel reads as Brown's inked groove.
  - **Depth:** the groove is shallower (floor 0.13 against lands at 0.30, previously 0.03), which cuts the wall shadows.
  - **Roller:** shortened to 0.48 so it clears the floor by 0.03.
  - **Start pose:** the plate's lobes lie 6° on from Brown's, with the roller just past the three-o'clock lobe.
- **Numbers:**
  - Minimum convex radius 0.306 and minimum concave radius 0.631, both above the roller's 0.16.
  - Groove width is exactly 2 × 0.1606.
  - Wheel speed ratio is 3.0:1. It was 9:1, but that ratio only existed because of the wobble.
- **Captures:** `a398-zm.png` (default zoom, two obliques; before `b398-z.png`, `/dev/shm/p90/e/C/398-m.png`), `a398-tile.png`, `cmp2.png`.
- **Tests:** `movement-398` now also asserts six curvature sign changes, a concave radius above the roller, and a speed ratio above 2.5. It passes together with `groove-drive-working-solids`; see the test log.
- **Screens:**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The near-misses are the unchanged rod-eye clearances.
  - Coincident faces: 0.
  - Seams: 0.
- **Residuals:**
  - The speed variation is gentler (3:1). The plate's "intermittent" motion is shown as a strong slow-down, not a dwell.
  - Brown's crank points up-left, which cannot be matched with the roller at the lobe tip (unchanged p84 note).
  - The crank throw is still 0.40.

### 362 (medium): groove runs out at the ends
- **Verdict:** confirmed. The groove edge reached x = ±0.406 on a 0.41 half-length cylinder, leaving a 0.004 land.
  - Brown's diagonal does run corner to corner. A working pin needs a land, though, so this is a deliberate departure from the plate.
- **Change:**
  - The cylinder is now 0.94 long (was 0.82) and the traverse amplitude 0.27 (was 0.32), which leaves a land of 0.114 (0.66 groove widths) beyond the groove at each turning point.
  - The groove solid is rebuilt in the owning file with 1024 steps round (the helper used 256), so the walls no longer stair-step.
- **Captures:** `a362-tile.png`, `a362-zm.png`, `a362-top.png` (both turning points, from above).
- **Screens:**
  - Disconnected parts: the near-misses are bore clearances, and the barrel now sits 0.015 from the middle-post bearing (was 0.075).
  - Coincident faces: 0.
  - Seams: 0.
- **Residuals:**
  - The drum's traverse is 16% shorter than before.
  - Brown's groove runs fully to the corners; ours stops one land short.

### 366 (medium): feed linkage out of the shaft plane
- **Verdict:** confirmed.
- **Change:** the upper lever, vertical link, treadle and both fulcrum posts move from z 0.72 to z −0.36. That is Brown's plane, just behind the drill shaft and in front of the C-frame (front face −0.54).
  - **Removed:** the yoke, the finite thrust link, the lever-tip pin and the dog-leg bracket.
  - **Lever tip:**
    - The lever ends in a round eye with a short slot (travel ±0.0095 about 0.8292 from the fulcrum), riding a pin that runs back from the thrust collar.
    - The collar is now a swivel at the top of the shaft: the shaft is lengthened to reach it, above the frame as Brown draws.
    - The collar moves exactly vertically: y = pivot + 0.82·tan(angle).
  - **Fulcrum post:** the upper fulcrum post is now a short upright on the frame's top arm, in the frame plane.
  - **Treadle:** now passes behind the bit, as on the plate (this also fixes the low finding).
- **Numbers:** over the cycle the slot line error is below 3e-16 and the slot travel excess is 0.
- **Pivot hub:** the body screen then found the upper pivot hub (0.48 long) cutting 0.03 into the frame's top arm, so the hub is now 0.30 long. After that, solid and coaxial overlap are both 0.
- **Captures:** `a366-tile.png` (plate, default, r1, r2), `a366-zm.png` (lever-to-shaft joint from front and behind, and at the fulcrum).
- **Tests:** `movement-366` swaps the thrust-link assertions for slot assertions. `drill-feed-solids` asserts that the pin passes through the lever eye and that both levers sit behind the shaft.
- **Screens:**
  - Disconnected parts: no detached parts. The pin near-misses are the slot and collar clearances.
  - Coincident faces: the three flagged pairs are the pre-existing lever-bore/boss-bore walls, which the audit dismissed as filled by the pivot pin.
  - Seams: 0.
- **Residuals:**
  - The pivot hubs and pins still stand about 0.16 proud of the lever face (existing style).
  - The low findings remain: the long crank shaft and the plain cone drill.

### 367 (medium): links and arc floating
- **Verdict:** confirmed. However, the arc does cross the right link's pin plane in the closed poses (the arc is the closing stop), so some layering is still needed.
- **Change:**
  - **Ivory scale:** now inlaid flush in a 0.032 pocket in the upper blade.
  - **Brass arc:** lies on the blades at 0.107–0.142. Its fastening pin runs through a new bore in the lower blade to 0.012 proud.
  - **Links:** lie just above the arc, underside 0.148 (was 0.25), so the exposed shank is 0.043 instead of 0.145.
  - **Link pins:** end 0.02 proud of the link eyes (were 0.14).
  - **322 and 323 unchanged:** their geometry hashes over four poses match before and after (`hash.mjs`: 322 ca3e3423ac93e492, 323 6c685038ffc6de73).
- **Captures:** `a367-tile.png`, `a367-zm.png`.
- **Screens:**
  - Disconnected parts: the scale/arc near-miss is gone.
  - Coincident faces: 0.
  - Seams: 0.
- **Residual:** the links clear the blades by 0.043 (the arc's thickness plus 0.006), because the right link crosses over the arc.

### 371 (medium): messy teeth, big yoke
- **Verdict:** partly disagree. A web between the rims is impossible without redesigning the pinion.
  - The pinion's tips pass through the wheel's median plane between the teeth (measured |z| reach 4e-7 at r 1.505 on the front run).
  - So Brown's band here is a lantern-like ring of radial bars. The see-through gaps are required.
  - The messy look was real, though:
    - Each bar's uncut stock ends showed as necks where the cutter-shaped working length met 0.12-thick rails.
    - The two halves were two colours.
- **Change:**
  - **Rims:** the rails become solid rims (r 1.29–1.495 and 1.97–2.11) as deep as the tooth stock (±0.136). The pinion never reaches those zones: its closest approach is 0.187 in the outer zone and none in the inner.
    - So every bar's stock ends and shoulders are buried in the rims, and each tooth shows only its smooth working length.
    - Small rim extensions (0.07 rad) past each terminal cover the terminal bars. They sit only where the rollover never reaches (r < 1.45 and r > 2.0, checked with a 0.07 rad margin).
  - **One colour:** the rear half-bars now use the front material.
  - **Guide:**
    - The undrawn rectangular yoke, two rails, two crossbars, two shoes, the bridge and the collar are hidden (kept allocated for existing checks).
    - One small fixed slotted plate (0.52 × 1.22 × 0.12) takes their place. The input shaft rides its z-slot with 0.006 clearance.
    - Like the wheel's bearing in this source presentation, it has no frame.
- **Captures:** `a371-tile.png`, `a371-zm.png` (rims and teeth, and the guide at two phases), `a371-zm2.png` (terminal and opening).
- **Tests:**
  - `movement-371` asserts the guide plate, the hidden yoke, rim depth and a single tooth material.
  - `reversing-transmission-working-solids` now checks the shaft against the guide plate; the journal clearance is 0.0049.
  - `reversing-transmission-tooth-contact` passes unchanged: bidirectional gap 0.0015 and useful-face maximum 0.0044.
- **Residuals:**
  - The tooth sections still vary along the radius (cutter envelope of a spur pinion on a face wheel) with smooth shading.
  - The outer rim shows a small step where the terminal extension (2.0–2.11) meets the full rim (1.97–2.11).
  - The guide plate floats (no frame), as do the wheel's own bearings.

### Test and screen summary
- **Tests:**
  - With the stub loader: `movement-362`, `-366`, `-367`, `-398`, `drill-feed-solids`, `groove-drive-working-solids` and `cord-traverse-working-solids` give 51/51. The one intermediate failure was a feed-law wording regex, now fixed; 366 plus `drill-feed-solids` then re-ran 17/17.
  - `movement-371`, `reversing-transmission-working-solids` and `reversing-transmission-tooth-contact` give 14/14.
- **`screen-body-intersections`:** worst solid 0 for 362, 366, 367, 371 and 398. Coaxial overlap is 0 after the 366 hub fix.
- **`screen-disconnected-parts` and `screen-coincident-faces`:** as reported per ID above. `disc*.json` and `cf*.json` are in this directory.
- **`check-loop-seams`:** 0 seams above tolerance for all five.
- **Validation reports and bakes:** no saved report or bake fingerprints any of the five changed files, so nothing was regenerated.

---

## p90-fe sub-lane D: 372, 373, 375, 378, 383 (medium); 363, 368, 374, 381, 382 (low)

Reviewer: Claude Opus 5.5, sub-lane p90-fe-D. Date: 2026-09-27. No git writes.

- Before captures: the audit's `/dev/shm/p90/e/cap/<id>-*.png`, `tiles/<id>.png`, zooms in `/dev/shm/p90/e/B/`.
- After captures (all in `/dev/shm/p90/fe/D/`): `a-<id>-{d,r1,r2,b,p1,p2}.png` (default, yaw +50/pitch 20, yaw -50/pitch -15, behind, phases 0.33/0.67), zooms `a-<id>-z*.png`, and `tile-a-<id>.png` (plate beside d, r1, r2, b, p1).
- Tests were run in a snapshot (`/dev/shm/p90/fe/D/snap` = HEAD + this lane's files), because other lanes' in-progress edits (guernsey-anchor, reed-396) break the registry import in the live tree.
- Screens: `disc.json`/`disc2.json`, `cf.json`/`cf2.json`, `bi.json`/`bi3.json` (body intersections), and loop seams, all in this directory.

Files claimed and changed: authored-dynamometers.js, authored-rolling-friction-experiments.js, authored-edge-runners.js, authored-pendulum-saws.js, authored-textile-dressing.js, authored-seesaws.js, authored-cylinder-spiral-scribers.js, authored-treadle-eccentric-drives.js, authored-wedge-clamps.js, authored-adjustable-stands.js. `scriber-dynamometer-gears.js` was claimed but not edited. Shared helpers (roller-working-parts, treadwheel-working-parts, reciprocating-cord-working-parts, textile-planer-working-parts, spring-pivot-family-parts) were NOT edited; each fix is an override in the movement's own file, so 365, 376/377, 359, 392 and 388 are untouched.

### 372 (medium): bevels were full cones
- Verdict: confirmed. The plate's four miters are an outer toothed band round a central window.
- Change: inner cone distance 0.27 to 0.62 of the 0.94 outer (face width 0.32, about a third). Each bevel now ends in a flat inner face; the window shows the carrier boss, arms and shaft.
- Captures: `tile-a-372.png`, `a-372-z1.png`, `a-372-z2.png` (flat inner face of the upper miter).
- Validation: `docs/validation/368-372-contact-solids.json` regenerated (33 poses, 0 penetrations for both). The smallest sampled backlash at 372 rose from ~0.002 to 0.0041, because it is now measured at the larger inner radius; `tests/scriber-dynamometer-solids.test.mjs` bound for 372 relaxed to 0.005 with a comment.
- Screens: disc 0 detached; cf 0; bi 0; seams 0.

### 373 (medium): pulley behind the rail
- Verdict: confirmed (the rail shows through the pulley's openings on the plate).
- Change: pulley and belt plane moved forward (pulley centre z 0.52 to 1.11, belt plane 0.70 to 1.29) so the pulley stands in front of the rail (z 0.94..1.16); the wheel's axle now runs through the rail to the pulley (z -0.25..1.39). The remote driving pulley and belt follow.
- Low (fixed): the load stones are lower and blockier (heights 0.60-0.76, was 0.74-0.92) so the heap reads fuller; widths kept, because the middle is reserved for the animated test-weight heap (a wider set intersected it).
- Captures: `tile-a-373.png`, `a-373-z1.png`, `a-373-z2.png`, `a-373-heap2.png`.
- Screens: bi 0; cf 0; disc: the pre-existing tether open end; one new "sliver" lead where a tilted stone rests on the bed on its lowest corner (natural for a heap of stones; left).

### 375 (medium): shaft unsupported at the top
- Verdict: confirmed.
- Change: the overhead frame (crossbar, both standards, input-bearing standard) is moved into the shaft plane (z 0). The crossbar is re-extruded with a bore, and a bored bearing boss (r 0.19, bore 0.099) carries the vertical shaft; it stands 0.03 proud of the crossbar, clear of the bevel. The large bevel's bore is closed to the shaft (0.096, was 0.11), so it is keyed. Also fixed a latent coincident-face fight flagged by the cf screen (stone and hub bores both 0.089): the stones are now bored 0.12 inside their hubs, and the cross axle runs out flush with the hub ends (was 0.06 short).
- Captures: `tile-a-375.png`, `a-375-z1.png` (input side), `a-375-z2.png` (top).
- Screens: disc 0 detached (the audit's floating runner assembly is gone); cf 0 flagged (was 2); bi 0 (a first boss height cut the bevel body by 0.038; lowered); seams 0.
- Not done (low): pinion/crown ratio (0.29 vs Brown's ~0.45-0.55) would change the 36:12 law and its tests.

### 378 (medium x2): saw shape; pendulum legs
- Verdict: both confirmed.
- Saw: one symmetric bow-saw frame extrusion: two waisted circular-arc standards (sagitta 0.12) whose tops scroll outward in a 200-degree constant-width arc, a stretcher on the slider-pin line, and a bored boss round the slider pin. The blade and its 27 crosscut teeth are one dark extrusion (the separate low-poly 3-sided cone teeth and box blade are gone). Span 2.58 and top 0.36 above the pin so the scrolls clear the carriage rope anchors and counterweights (first versions intersected them by 0.083/0.072).
- Legs: closed round bars from the pivot to small pads on one common ground line (y -2.0), which the log plank already stood on. The frame posts and feet now reach the same ground line (feet were 0.54 higher than the plank).
- Low (fixed): the bob is Brown's spade (straight sides closing in two tangent circular arcs), one flat extrusion.
- Low (not done): the saw still rises out of its kerf once per feed loop (prescribed feed law); the rod's three adjustment holes are not drawn.
- Captures: `tile-a-378.png`, `a-378-z1.png` (frame), `a-378-z3.png`, `a-378-bob.png`.
- Tests: movement-378 updated (saw frame and blade are extrusions, symmetric about the blade middle, 27 teeth recorded, A-frame feet/closed legs).
- Screens: bi 0 (final); cf 0; seams 0; disc: the log group remains "floating" (pre-existing: it stands on the undrawn ground).

### 383 (medium x2): crossbars; brush cylinder
- Verdict: both confirmed. Brown's end elevation is a section through an arched end plate: outer outline plus a parallel inner line (the flanged rim), and two bars just under the rolls; no bar crosses the brush cylinder.
- Frame: each end is an arched plate: rim and two ribs (under each roll, 0.03 clear) in one full-depth extrusion, and a 0.04 web filling the arch on its outer side, holed for the three bearings. All crossbars (including the one across the cylinder) are gone; the three axles bear in the plates. The near plate's web uses the standard see-through style so the rolls read as in Brown's section; its rim and ribs stay opaque.
- Cylinder: Brown's construction: a spoked ring (hub, four spokes, ring) as one extrusion along the cylinder, eight board staves and a bristle pad on each board out to the cloth radius (brushCount 12 to 8).
- Captures: `tile-a-383.png`, `a-383-z1.png` (cylinder), `a-383-z2.png`.
- Tests: movement-383 updated (no bearing bars, see-through near web, 8 boards and 8 brush pads).
- Screens: disc 0; cf 0; bi 0 (pre-existing open cloth ribbon); seams 0.
- Residual: the see-through near web tints the whole default view slightly.

### 363 (low): shoe and cleat overhang
- Change: shoe heel, end board and cleat are now exactly the plank's depth (0.34; were 0.52-0.56). Captures `tile-a-363.png`. Screens clean.

### 368 (low): torus bearings, small pedestal
- Change: each input-shaft bearing is one flat extrusion (post as wide as its round bored top, bore 0.076 on the 0.072 shaft); the torus collars are gone. The horizontal bevel stands on a broad bored pedestal block (0.66 x 0.25 x 0.50) instead of the small collar.
- Captures: `tile-a-368.png`, `a-368-z1.png`. Screens: cf 0; disc lip lead 0.03 at post/table (post base on the table top; not visible).

### 374 (low): drive arm, small shaft
- Change: the undrawn rear drive arm is removed (the solid eccentric disk is keyed on the shaft through it). The shaft is Brown's large one (r 0.26, was 0.105), with its bearing (r 0.39) and standard following. The treadle already tapered (helper), left as is.
- Captures: `tile-a-374.png` (b view shows no arm). Tests: reciprocating-cord-working-solids 374 radii updated.
- Residual: Brown's dotted wheel behind the eccentric is still not modelled (not in the audit).

### 381 (low): default unclamped
- Change: insertion law 0.5(1+cos), so phase 0 is clamped as drawn. Tests movement-381 and adjustment-contact-solids updated (clamped at t=0, rest at half period).

### 382 (low): mirror too small
- Change: frame 3.20 x 3.60 (was 2.48 x 2.86), grown upward from the old lower edge so the tested collar clearance is unchanged; the two back panels scaled to Brown's long panels. Camera fit bounds now sampled over the adjustment cycle.
- Residual: the hinge sits in the frame's lower third; Brown draws it near the middle (moving it would need the frame farther behind the stem to clear the collar).

## Tests (snapshot)
movement-363/368/372/373/374/375/378/381/382/383, edge-runner-bevel, reciprocating-cord-working-solids, seesaw-finite-supports, scriber-dynamometer-solids, textile-planer-working-parts, treadwheel-working-solids, roller-working-solids, adjustment-contact-solids, spring-pivot-family-solids: all pass. camera-catalog passes after regenerating display profiles for these IDs (snapshot only).

## Integration notes
- `src/data/display-profiles.{json,js}` must be regenerated for 363 368 372 373 374 375 378 381 382 383 (`node scripts/measure-display-profiles.mjs 363 368 372 373 374 375 378 381 382 383`) at integration; not written here because the file is shared generated data and the live registry is currently broken by other lanes. Without it camera-catalog fails on 382.
- source-presentation 383's note still says "strap frame with its crossbars"; it now reads as a flanged end plate with ribs (file claimed by another p90-fe sub-lane; not edited).

---

## Sub-lane p90-fe-E: 395, 400, 401, 384, 385, 386 (medium), 405 (low)

Captures are in `/dev/shm/p90/fe/E/`:
- **Before:** the auditor's captures, `/dev/shm/p90/e/tiles/<id>.png` and `/dev/shm/p90/e/C/<id>-*.png`.
- **After, final tiles:** `ftile-<id>.png`, which shows the plate plus the default view, yaw +50/pitch 20, yaw −50/pitch −15, behind, and phase 0.33. Single frames are `f<id>-{d,r1,r2,b,p1,p2}.png`.
- **Zooms:** `a<id>-z*.png`.

Screens were run on a scratch copy of the tree (`/dev/shm/p90/fe/E/tree`). In that copy, `reed-396-contact.js` is the HEAD version, because lane 396's in-progress edit makes `registry.js` throw `JDROP is not defined`. Outputs: `disc2.json`, `cf2.json`, `bi2.json`, `seams2.log`, plus `bi3/cf3/disc3.json` for the final 395.

Claims:
- **Held (p90-fe):** `four-way-cock-parts.js`, `door-closer-working-parts.js`, `source-presentation.js`.
- **Released:** `display-profiles.json` was claimed only for an entry merge and released straight after.
- **Not claimed:** `helicograph-working-parts.js` was left unedited, so it needed no claim.

### 395: agree (a leaking cock and scoop passages)
- **Before.**
  - The ring had square notches around round pipes, and the pipes stopped 0.08 short of the plug.
  - The passages were open channels cut into the plug face, and they ended in knife-edge crescents.
- **After** (`four-way-cock-parts.js` rewritten; `authored-four-way-cocks.js`). There are two closed, watertight solids (0 non-manifold edges).
  - **Body:** one flat extrusion of the ring plus four port pipes. Each pipe leaves radially and bends on the plug radius toward Brown's corner, reaching 3.27.
  - **Ducts:** one closed square duct (0.40) per port, running from the bore to the open pipe end. The pipe ends are the body's only openings.
  - **Plug:** one disc bored by two closed quarter-circle passages of the same section. Their arc radius equals the plug radius (as drawn), so each passage meets its ports radially and face to face at both indexed angles.
  - **Visibility:** the plug takes the standard see-through style (brass tint), so the passages read as Brown's double arcs.
  - **Removed:** the old pipes and the cream open-channel plug.
  - **New helper:** `voidedPlate` plus `closeTJunctions` make the layered plates watertight.
  - **Build time:** 0.82 s cold / 0.53 s warm; it was 1.08 / 0.37 s.
- **Knock-on changes.**
  - `display-profiles` entries for 384, 385, 386, 395, 400 and 401 were re-measured and merged (395's bounds grew to 3.27 for the pipes).
  - The source-presentation note was updated.
- **Captures:** `ftile-395.png`, `f395-mid.png`, `a395-z1.png`.
- **Screens:** body intersections 0 with no open meshes; coincident faces 0; disconnected 0; seams 0.
- **Tests:** the two 395 tests in `cock-ferry-working-solids` were rewritten to cover closed passages, closed ducts, the see-through plug, the pipe ends as the only openings, and 0 plug/body penetration. `movement-395` passes.
- **Residual:**
  - The pipes and passages are square in section.
  - The see-through plug is a presentation choice; Brown's figure is a plain section.

### 400: agree on all three findings
- **Teeth.** The cone pyramids are replaced by one extruded feeder plate in B's width.
  - It has five raked teeth (a long back slope and a steep face toward the feed) and Brown's upturned toe.
  - B's beam now butts against the plate instead of running through it.
- **Spring.** It now lies below A at the left, as drawn.
  - It bears between A's downward leg (one cross-piece joining both cheeks, which now run down past B's pivot) and a fixed cup socket.
  - It compresses as A feeds.
  - The old top cross-leg and the floating stop inside the fork are gone.
- **Pads.** The stem-and-ball pads are replaced by round-ended feet with no neck (a hemisphere continued as a cylinder of the same radius, r 0.08).
  - B's foot rises straight into the bar. A's nose runs straight from the (taller) bridge to the cam face.
  - The contact law is unchanged, because the hemisphere centre is the old sphere centre.
- **Also:** the cheek depth now matches the rail (0.13), which removes the rail lip.
- **Captures:** `ftile-400.png`, `a400-zdog2.png`, `a400-zspring.png`, `a400-zcam.png`.
- **Screens:**
  - Disconnected: 0 detached, 0 lips (was 1).
  - Coincident faces: 0.
  - Intersections: 0. The only open mesh is the tube spring, which predates this pass.
- **Tests:** `four-motion-feed-solids` (3) and `movement-400` pass. They now check the tooth tips, and the absence of the stem pad and cone teeth.
- **Residual:**
  - The socket cup is whole, where Brown hatches it as a section, and it has no drawn support (Brown draws none).
  - Both feet are small round-ended pegs rather than Brown's block.

### 401: agree
- **Spring B.** The zero-thickness DoubleSide ribbon is now a closed flat strip: 0.075 wide, 0.05 thick, four walls plus end caps. It is rebuilt each frame as it winds.
  - `noRotationIndicator` is set, so it no longer carries the quadrant cue.
  - Its tail is a smooth cubic curl from the volute's end to the slide's lower edge. The old straight tail folded the strip back on itself.
- **Low fixes also done:**
  - The hub now stands proud, and the faceplate bore is 0.128 against the hub's 0.124, so the bore walls no longer fight.
  - The treadle eye hole was widened (0.10) inside its boss.
  - The wrist and rear-joint pins were trimmed to about 0.02–0.04 proud of the pitman. The rear pin starts 0.01 behind the treadle, so it no longer fights the treadle's back face.
- **Captures:** `ftile-401.png`, `f401-zs.png`, `a401-zm.png`.
- **Screens:** coincident faces show one pair (spring tail against the attachment pin) at 1.9e-7 area, below the visibility filter. Disconnected 0; intersections 0.
- **Tests:** the `movement-401` spring test was rewritten (thickness, triangle count, winding against normals); 401 passes.
- **Residual:** Brown's spring end reaches up to the wrist; the model's ends on the slide's lower edge, behind the slide.

### 384: agree
- **Screw.** The core is now 0.8 of the thread's major diameter (0.128 of 0.159). Thread and core are one steel material, so the rod reads as a solid threaded rod, not a spring.
  - The arm bridge was thickened to 0.28 so the thicker rod doesn't lip past it (the screen lip is now 0).
  - The screw was lengthened to 5.20 so the nut stays on it.
- **Wheel.** The torus, face ring and eight wire spokes are replaced by one solid brass wheel:
  - a knurled rim of 240 V ridges with their tips on the rolling radius (the paper-gap test passes, < 1.4e-4);
  - a web with sixteen radial face ribs;
  - Brown's long nut on the side away from the point (r 0.36 R, length 0.55 R).
- **Camera:** yawed about 17°, as the audit's low finding suggested (source-presentation camera [0.3, 0.36, 1]).
- **Captures:** `ftile-384.png`, `a384-zw.png`.
- **Screens:** all 0 (the bridge lip is fixed).
- **Tests:** `helicograph-working-parts` (5) and `movement-384` (16 ribs) pass.
- **Residual:** framing on the whole sweep keeps the instrument small (documented).

### 385: partly agree
- **Done.**
  - The clevises, bridges and retainers are replaced by Brown's plain eye on each pin top beside the link eye, joined by one short cross pin.
  - The apex axle is shortened, with no caps.
  - The suspension plate, second pin and retainer are gone. The weight hangs on an S-hook from the apex pin, in the links' mid-plane. Its eye stands across the hook plane so the lower hook threads it.
  - The weight is a smooth 72-segment spline lathe with a round bottom.
  - The default view is cropped to the linkage above y 2.29, so the door and wall show only at the bottom edge.
- **Not done: the door and wall.** They carry the two pins, and without them the door pin's orbit about an invisible hinge is unexplained. They are kept as a minimal hint below the linkage.
- **Captures:** `ftile-385.png`, `a385-zm.png`, `a385-zapex.png`.
- **Screens:**
  - Coincident faces and intersections: 0.
  - Disconnected: one "sliver" between the hook and the weight eye. That is the hanging bearing contact, and it is correct.
  - Lips 0.035 where the round pin (dia 0.17) narrows to its 0.10 flat tongue.
- **Tests:** `door-closer-working-solids` was rewritten for plain eyes, the S-hook and two links (6 pass); `movement-385` passes.
- **Residual:**
  - A small shoulder where each pin flattens into its eye.
  - The door, wall and hinges are undrawn (hint only).

### 386: agree
- **Change.** The recessed plugs are now flush, recessed 0.004 instead of 0.09.
  - At a recess of 0 the opposite complement grazes the plug by 0.0003 at phase 0.29.
  - At 0.004 the full-cycle pairwise check (`pairs.mjs`) and the screens give 0.
- **Captures:** `a386-ends.png`, `ftile-386.png`.
- **Screens and tests:** clean; `movement-386` passes.

### 405: disagree
The detached "border" bar the audit saw is not a border. `boardFrame` is hidden (`hyperbola-finite-cord.js:19`). The bar is the edge of the drawing board itself, whose face is page-toned, so only its edge shows when rotated. That is already documented in the ledger limits. No change.

---

## p90-fe sub-lane F: 403–424 (406, 407, 409, 411, 415, 419, 424; lows 408, 417, 420, 421)

Reviewer: Claude Opus 5.5, sub-lane p90-fe-F. The before captures are the audit's own (`/dev/shm/p90/e/tiles/<id>.png`, `/dev/shm/p90/e/D/`). The after captures are in `/dev/shm/p90/fe/F/after/`:
- `tile-<id>.png` puts the plate beside the default view, yaw +50/pitch 20, yaw −50/pitch −15, behind, and phases 0.33 and 0.67.
- Zooms are listed per ID.

Tests and screens ran in a shadow tree: Git HEAD plus this lane's files only. At the time, other lanes' in-progress edits (`reed-396-contact.js` and `authored-treadle-drills.js`) broke registry imports in the live tree. The shadow tree is `/dev/shm/p90/fe/F/shadow`, built by `sync.sh` from the files in `myfiles.txt`.

Files claimed and edited:
- `authored-square-piston-engines.js`
- `authored-self-rocking-cradles.js`
- `authored-dickson-reversible-drives.js`
- `authored-parabola-drawing.js`
- `authored-pointed-arch-instruments.js`
- `authored-proportional-compasses.js` (unchanged in the end)
- `authored-cyclographs.js`
- `authored-self-recording-levels.js`
- `drawing-template-parts.js` (claimed, unchanged)
- `drawing-gauge-parts.js` (shared)
- `authored-centrolineads.js`
- `authored-bent-shaft-slides.js`
- `authored-spring-return-bell-hammers.js`
- `authored-trunk-engines.js`

Shared-helper proof: `drawing-gauge-parts.js` is also used by 410, 499 and 500. `geohash.mjs` hashes every mesh's positions, matrices and visibility at five phases. Their hashes are byte-identical between HEAD and the edited tree:

| ID | Hash |
|---|---|
| 410 | 5b2d33ed90a340fe |
| 499 | 276560ff29867ddf |
| 500 | 72eeb3307b45cfb1 |

408 is this lane's own movement.

### 424 (medium): crank hidden behind C
- **Verdict:** agree. Brown dots crank a–b behind C.
- **Change:** C's front and back plates get the standard `makeSeeThrough` style. The crank circle always lies inside C's outline, so B needs nothing.
- **Captures:** `after/tile-424.png`. The crank arm, shaft b and pocket show through C at every phase and in rotated views.
- **Tests:** movement-424 passes 4/4, including a new check that C is see-through and the crank is not.
- **Residual:** the dark wrist pin's shadow shows through C as a faint diagonal band.

### 419 (medium): A overlaps rocker E
- **Verdict:** agree on the overlap. The auditor's "0.87" is a rotated bounding box; A's true radius was 0.66, and Brown's is about 0.59 (half of B).
- **Change:**
  - A's radius is 0.59.
  - The cradle and floor are 0.12 lower (`groundY` −2.72).
  - The standards are 0.12 taller, so the band attachments C and D stay put.
  - A now clears E's bed by at least 0.061 over the whole rock (it overlapped by 0.10 before).
  - Low item: each standard is now one flat extrusion whose inner edge sweeps into E's bed on a 0.42 fillet, as Brown draws the U. The old `beamBetween` boxes are removed.
- **Captures:** `after/tile-419.png`. The before zoom is `before/419-z.png`.
- **Tests:** movement-419 passes 12/12, including a new test for A's radius and its clearance over E.

### 415 (medium): lever A, pawls B/C, cords
- **Verdict:** agree on all three.
- **Change:**
  - **Lever A** is one flat T plate:
    - a flat-topped crossbar whose ends curl down into horns (arcs about points on the top line);
    - a straight underside filleted into the stem (r 0.14);
    - a stem ending in an arc concentric with the input pin;
    - a round boss round the shaft, and lugs under the pawl hinges.
  - **Pawls** are straight blades of constant width, 0.19. `correctDicksonParts` clips each one to D's inner circle at its seated angle, so the end bears on the rim along an arc.
  - The trailing corner is cut obliquely (Brown's oblique end). A square end's trailing corner would swing into the rim as the pawl lifts; Brown's pawls are nearly radial. The one-way-clutch sweep confirms it: penetration stays under 1.7e-5.
  - **Cords** run straight and taut from E's pin to the pawl eye. The slack, up to 0.24 of chord change, is stated as taken up at E's pin and is not drawn.
- **Captures:**
  - `after/tile-415.png`
  - `after/415-z.png` (phases)
  - `after/415-tips.png` (C's oblique end on the rim)
- **Tests:**
  - movement-415 passes 14/14. The rendered-length assertion now expects the chord, and there is a new shape test.
  - one-way-clutch-working-solids passes 5/5.
- **Residuals:**
  - Both cords attach 0.58 along the blade; Brown ties C's cord near its tip.
  - The slack take-up at E is not modelled.
  - The shared helper `one-way-clutch-working-parts.js` is untouched.

### 406 (medium): parabola stops short of the blade foot
- **Verdict:** agree.
- **Change:**
  - The square's travel runs until the pencil meets the thread's anchor block at the blade end: lowest pencil y is the foot plus 0.195, and the travel is ±2.39 (was ±2.05). The drawn locus runs to the same limits.
  - The straightedge is 5.9 long (was 5.33), so the stock stays on it.
  - The focus pin top is lowered to 0.255, below the blade-side thread run. Before, the thread passed through the pin at the vertex crossing (screen depth 0.054; now 0.038 → 0, see Screens).
- **Captures:** `after/tile-406.png` and `after/406-ext.png` (both extremes).
- **Tests:** movement-406 passes 8/8. The minimum blade-segment bound drops to 0.19, and ULP tolerances were loosened a few ULP because the travel is now irrational.
- **Residuals (low, not done):**
  - The stock is still a symmetric T flange; Brown's is one-sided with a fillet.
  - The anchor block is still at the blade foot, because it carries the anchor stud.

### 407 (medium): elastic bar reads as a tube
- **Verdict:** partly agree. The bar already had a rectangular section, but its shared vertices smoothed the normals, so it shaded round.
- **Change:**
  - Each long face and each end cap now has its own vertices: 8 per sample plus 8 for the caps. The faces shade flat.
  - The depth is 0.10 (was 0.18), so it reads as a thin lath.
- **Captures:** `after/tile-407.png`.
- **Tests:** movement-407 passes 7/7; the vertex count is updated.
- **Residual (low, not done):** the winding-peg slide pin with its thumb wing is kept; it is the documented cord take-up.

### 409 (medium): leg outline
- **Verdict:** partly agree. Measured on the plate, the bar width (0.09 of length), slot (0.35 of width) and end holes (0.8 of width) already matched. What was wrong:
  - bulb bosses 0.62 wide on a 0.46 bar;
  - needle points springing from inside the bulbs;
  - a narrow neck before the long points.
- **Change** (in `correctProportionalCompasses`, in `drawing-gauge-parts.js`):
  - The ends are round with radius equal to half the bar width.
  - The short points taper straight from tangents to that round end.
  - The long points taper from a 0.30-wide base under the extracted serrated grip.
  - The existing scale ticks stay.
- **Captures:** `after/tile-409.png`.
- **Tests:**
  - movement-409 passes 10/10, with a new test for no bulbs.
  - drawing-gauge-solids passes 6/6.

### 403 (medium): rules too slender
- **Verdict:** agree.
- **Change:**
  - The rule width is 0.40 (was 0.25), so width/length is 0.057 against Brown's ≈0.055. The brace is 0.36 (was 0.22).
  - The right rule now lies on the left rule where they cross (z = rule depth + 0.002). Before, the two bodies interpenetrated by 0.085, inside one rigid carriage, so the screen never saw it.
- **Captures:** `after/tile-403.png`.
- **Tests:** movement-403 passes 11/11 with a new width/stacking test; cyclograph-contact-solids passes.

### 411 (medium): drive
- **Deferred with reason.**
  - Brown's ribbed pinion is on the drum shaft (x axis), 0.61 above and 0.54 inboard of the left wheel's axis (z axis).
  - Its axis does not meet the wheel's axis. No crown or face wheel on the wheel's hub can mesh with a straight spur pinion there; that would need a skew (offset) face gear.
  - So a right-angle stage plus a lift are forced. The documented bevel and 1:1 spur pair remain.
- **Low item fixed:** the spokes are 0.095 deep, within the 0.10 rim and tyre. That removes the 16 lips of 0.019.
- **Tests:** movement-411 passes 11/11.
- **Not done:** the flat pendulum bar with eyes.

## Lows
- **408:**
  - The central joint is a 0.06 pin (was a 0.14 black boss). Head and leg bores are 0.062.
  - The blade root has Brown's round screw head (r 0.105) and a small square rivet, sunk 0.01 into the blade top.
  - Captures: `after/408-z.png`, `after/tile-408.png`.
  - Tests: movement-408 passes 10/10; drawing-gauge-solids passes.
- **417:**
  - Head A is lathed with a conical collar flaring from the bend and a chamfered nut-like cap at the outer end.
  - Capture: `after/417-z.png`.
  - Tests: movement-417 passes 10/10.
- **420:**
  - The bell profile is measured from the plate: domed crown, narrow shoulder with two bands, straight flaring sides, and a band above the lip.
  - The canon is a flat, round-cornered trapezoidal loop, wider at the top.
  - The pull cord is 1.25 long (was 3.35), so the ringer's hand stays in the default view just below the plank's end. The camera-fit minimum is (−3.45, −2.55).
  - The strike geometry (lip radius and height) is unchanged.
  - Captures: `after/tile-420.png`, `after/420-z.png`.
  - Tests: movement-420 passes 11/11, with a new hand-in-view and canon test.
- **421:**
  - The flat black stuffing-box ring is replaced by a lathed gland casting: a raised boss round the trunk on a flange, with a round packing groove. It is cut by the existing cutaway, so Brown's section profile shows.
  - Captures: `after/tile-421.png`, `after/421-z.png`.
  - Tests: movement-421 passes 2/2; steam-engine-working-solids and piston-engine-solids pass (see below).

## Screens
These ran in the shadow tree. Outputs are in `after/{bi,bi2,disc,cf,cf2}.json`, `after/seams.log` and `after/tests.log`. The before screens are in `before/{bi,bi2,disc}.json`.

- **Body intersections:**
  - 403: 0.0086, pre-existing guide-pin versus apex-fastener contact.
  - 406: the focus-pin versus thread pass-through is gone (0.054 before). The worst is now 0.0106, the pencil tip on its own drawn line.
  - 415: 0 (the wedge contact).
  - 419: 0.
  - 424: none.
  - 408, 409, 411, 417 and 421: 0.
  - 407: 0.050 and 0.025, unchanged from before (pencil tip on the locus; bar end in its tip clamp).
  - 420: 0.103, unchanged pre-existing leaf-spring self and pad contacts.
- **Disconnected parts:** no new detached parts or slivers.
  - 411's lips dropped from 19 to 3; the 3 left are frame-box lips on the drum guide and brace, pre-existing.
  - 420's floating bell is the known case: Brown draws no hanger.
  - 403's pencil-graphite cap sliver is pre-existing.
- **Coincident faces:** my change in 415 created a lever-lug/pawl-eye fight (contrast 0.35). I fixed it by making the lugs 0.105, and it re-screened at 0 flagged. 420 has 7 tiny pre-existing spring-segment pairs (contrast 0.02, area 2e-6). Every other ID is at 0.
- **Loop seams:** 12 IDs checked; 0 seams, 0 pops, 0 errors.
- **Tests (shadow):** 403 11, 406 8, 407 7, 408 10, 409 10, 411 11, 415 14, 417 10, 419 12, 420 11, 421 2 and 424 4 pass. These family tests pass: cyclograph-contact-solids, dead-socket-cradle-solids, drawing-gauge-solids, drawing-template-working-solids, one-way-clutch-working-solids 9, piston-engine-solids, pendulum-instrument-solids, steam-seams-p88-s, steam-engine-working-solids and spring-pivot-family-solids.
- **Validation reports and bakes:** none fingerprint the changed files.
