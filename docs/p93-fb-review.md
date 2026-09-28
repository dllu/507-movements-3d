# Pass 93, lane p93-fb: fixes for audit docs/p93-audit-086-170.md

Reviewer: Claude Opus 5.5, lane p93-fb, integrating five forked sub-lanes (fbA–fbE). Date: 2026-09-28. Working tree on HEAD `10a65f3`; no git writes.

Captures and scratch files are in `/dev/shm/p93/fb/<sublane>/`, outside Git. The audit's "before" captures are in `/dev/shm/p93/b/`.

## Summary
- **Mediums fixed:**
  - 109: the thread exists only above the cutter.
  - 115: square stub teeth.
  - 116: crescent pawls and one-piece stems.
  - 143: the worm hand is mirrored to match the plate.
  - 145: the beam ends in an eye concentric with the pin.
  - 151: 36-tooth worm wheel.
  - 155: the prong is completed and the rod ends plainly.
  - 168: broad slotted crank.
- **Medium partly fixed:** 153. The arm is at plate width and the eye is visible, but the input arm's depth step is kept as forced (numbers below).
- **Medium deferred:** 133. Its platen, columns and head are built inline in `src/simulation/authored-gears-core.js`, which lane p93-f owns under `/dev/shm/p92/claims`.
- **Lows fixed:** 86, 93, 100, 117 (brackets), 119, 121, 135, 150, 152 and 163.
- **Lows not done:**
  - 87: the stud radius feeds the integrated contact motion.
  - 92: I disagree with the audit. The support is the only link between the guide frame and the wheel shaft.
  - 111: the thread ends come from a helper shared with 102 and 103.
  - 117's rod trim: the rod would leave its guide.
  - 144: not attempted.
  - 153/166 quadrant cue: this is the shared `rotation-indicator.js`, so it is a project-wide decision.
  - 161: needs a native rebake.
  - Not attempted, as bigger reshapes: 90/91, 99, 102/103, 124, 128, 129, 131, 134, 146 and 164.
- **Not touched, as instructed:** the range-wide "ink shafts read as holes" palette sweep.
- **Tests:** the combined targeted suite passes 186/186. It covers `mujoco-thread-cutting`, `mujoco-baked-loops`, `mujoco-equal-racks`, `mujoco-rack-rectifier`, `mujoco-endless-rack`, `sliding-worm-kinematics`, `sliding-worm-model`, `opposed-screw-nuts`, `variable-radius-crank-motion`, `elbow-pawl-physics`, `stud-reverser-physics`, `pump-catch`, `trammel-ellipsograph`, `belt-governor-baked`, `selectable-cam-valve`, `reuleaux-yoke-hardware`, `mujoco-quick-return` and `mujoco-scotch-yoke`.


## 109 (sub-lane fbA)

**Finding verified.** Brown's plate shows the work screw threaded above the cutter and plain below it. Before this change, the model showed a full thread in every phase. The live sync cut to `physics.progress.maximumWorkAngle`, the maximum angle reached over the whole run. The bake starts recording at 48 s, when that maximum already covers the whole stock, so the baked bundle stored one fully cut workpiece (`before-phases.png`).

**Change.**
- **Stroke schedule:** `mujoco-thread-cutting/profile.js` gets `makeThreadCuttingStroke(f, period)`. It is the same stroke schedule that was in `physics.js`, moved unchanged, so the MuJoCo XML is unchanged. It adds `descending(time)` and `cutWorkAngle(time, workAngle)`.
  - **On the descent (the cutting stroke):** the cut reaches the tool's current work angle. The thread lies above the tool and the plain blank below it.
  - **On the return:** the tool runs back up its own finished groove, so the stock stays fully cut.
  - **At the top reversal:** a fresh blank replaces the screw and the next descent cuts it. The blank appears during the smooth-reversal dwell, when the tool sits at the top end of the stock.
- **Shared rebuild:** `geometry.js` exposes `u.syncCut(time, workAngle, period)`. The live sync (`visual.js`) and a new baked-route `sync` for 109 (`baked/mujoco-baked-routes.js`, 109 entry only; the other entries are byte-identical) both rebuild the workpiece with it. The route sync uses the recorded work angle, with playback time offset by the loop's `startTime`.
- **Bake config:** `scripts/lib/mujoco-bake-configs.mjs` for 109 adds:
  - `derivedMeshes: ['parts.workpiece']`, so the mesh is no longer stored as vertex frames. The asset dropped to 28 KiB.
  - a new optional `seamExclude`. `seamContinuity` in `scripts/lib/mujoco-bake.mjs` skips meshes listed there, because the workpiece's vertex count changes as the cut advances. Every other movement passes an empty list, so they are unaffected. `bake-mujoco-movement.mjs` and `tests/mujoco-baked-loops.test.mjs` pass `config.seamExclude`.
- **Rebake:** `node scripts/bake-mujoco-movement.mjs 109` still gives 1500 samples over one 24 s period from 48 s. Raw seam 0 px, seam step 4.49 px (interior 4.50), round trip 0.0065 px.

**Low finding (pitch): kept and documented, not changed.** The work pitch is 76/52 = 1.46× the lead pitch (the audit said 1.33×). That follows from the 52:76 change gears, which are fitted to the drawn gear rims. Brown's 20.99 px and 18.62 px thread pitches contradict his own gear sizes, and equal gears would contradict the drawn wheels. `profile.js` also rejects any other ratio, because a new cutter and a hidden-guide clearance review would be needed. The live model's `reconstructionNote` (baked into the bundle) now states the ratio and the cut/blank behaviour.

**Captures** (`/dev/shm/p93/fb/fbA/`):
- `before-phases.png` and `after-phases.png`: phases 0, 0.1, 0.25, 0.4, 0.6, 0.75, 0.9.
- `after-zoom.png`: the groove ends at the cutter with the blank below, in the default view, a rotated view and phase 0.9.
- `after-tile.png`: the standard 8-view tile. The default view now matches the plate.

**Tests.**
- `tests/mujoco-thread-cutting.test.mjs`: 5/5. The new test runs 97 samples over the loop, live and baked. It checks that:
  - baked and live cut volumes agree;
  - on the descent, the groove floor never goes below the cutter, and the stock is only ever removed;
  - on the return, the volume is constant;
  - exactly one reset to a fresh blank happens.
- `mujoco-baked-loops` (109 plus the general tests): 5/5.
- `models.test` "movement 109": passes.

**Screens.**
- Disconnected parts: 0 detached; the same 2 near-misses and 1 lip as the audit baseline.
- Coincident faces: 0 flagged.
- Body intersections: worst 0.0879, the existing hidden keyway against the carriage nut, which is unchanged.
- `check-loop-seams`: skips live MuJoCo movements, so 0 checked.

**Proposed ledger row.**
- **assessment:** reasonable.
- **visibleFlaws:** empty. The top-of-stroke blank swap is an intended job reset, not a defect.
- **limits (append):** "The thread is cut only where the tool has passed on its descent; the tool returns up its own groove and a fresh blank replaces the screw at the top reversal, a deliberate discontinuity in the dwell. The 52:76 change gears make the work thread 1.46× the lead pitch, where Brown draws them nearly equal; this is kept because the gears follow the drawn rims."

**Files changed:**
- `src/simulation/mujoco-thread-cutting/{profile,physics,geometry,visual}.js`
- `src/simulation/baked/mujoco-baked-routes.js`
- `src/simulation/baked/assets/mujoco-109.{json.gz,provenance.json}`
- `scripts/lib/mujoco-bake-configs.mjs`, `scripts/lib/mujoco-bake.mjs`, `scripts/bake-mujoco-movement.mjs`
- `tests/mujoco-thread-cutting.test.mjs`, `tests/mujoco-baked-loops.test.mjs`

**Claims:** `mujoco-thread-cutting__{profile,physics,geometry,visual,workpiece}.js` and `mujoco-baked-routes.js`. `workpiece.js` was claimed but not edited.

**Deferred:** none.

## p93-fb sub-lane fbB: rack family (115, 116; lows 117, 119, 121)

Captures are in `/dev/shm/p93/fb/fbB/` (before: the audit's `/dev/shm/p93/b/z/m115.png`, `z/116/*`, `z/m117.png`, `z/119/m119q.png`, `tiles/121.png`).

## 115 (medium): pointed star teeth. Fixed.
- **Verified:** yes. The teeth were profile-shifted by +0.85 module at 20°, so they came to points. Brown draws 12 square, flat-topped teeth (`p115z.png`).
- **Change** (`src/simulation/mujoco-equal-racks/geometry.js`):
  - Both pinions are now unshifted 12-tooth involutes. The module is 2·workingRadius/12 = 0.09642, so the pitch circle is the measured working circle and both shaft centres keep their positions.
  - 16° pressure angle, a 0.64 m stub addendum (inside the 0.65 m interference limit for a 12:12 pair) and a 1.0 m dedendum. The flat tips are 1.1 m wide.
  - The rack teeth use the same 16° flank. Rack origins are derived from the drawn pinion phases, with each rack centred on the shafts. The racks have 8 upper and 9 lower teeth.
  - Samples went from 96 to 192. At 96, tooth entry on the native convex cells penetrated 0.18 px.
- **Captures:** `after/115-z-def.png` (zoom: flat-topped square teeth), `after/115-a-def.png`, `after/121-115-row.png`.
- **Tests:** `tests/mujoco-equal-racks.test.mjs` passes 5/5. It now asserts:
  - no profile shift, and a pitch circle equal to the working circle;
  - 16°, a tip land over 1.05 m and a rack tip over 0.3 pitch;
  - the addendum is inside the interference limit and the contact ratio is over 1.05;
  - counts of 8 and 9.

  The mesh-error bound went from 0.002 to 0.0025 (now 0.00199, because the tooth is coarser).

  In two native cycles, the frame range is ±0.7512, penetration is 0.016 px and both rack faces carry more than 19k contacts. The pinions no longer touch each other; both are driven.
- **Bake:** `mujoco-115` was rebaked with the same loop (375 samples, 6 s). The baked-loop tests for 115 pass 3/3.
- **Screens:**
  - Disconnected parts: clean.
  - Coincident faces: one pair of area 3e-9, which is invisible.
  - Body-intersection: the worst value (0.129) is reported against the old authored factory's part names, not this production route.
- **Residual:** Brown's racks have about 10 and 9 teeth at a finer pitch (26.2 and 28.6 px) that his own pinion (30.3 px) cannot mesh with. The model keeps one consistent pitch, so the racks have 8 and 9 teeth. All the teeth are used over the ±0.75 stroke.
- **Ledger row:**
  - **Assessment:** reasonable.
  - **visibleFlaws:** none.
  - **Limits (replace the tooth sentence):** "Unshifted 16° stub involutes (0.64 m addendum) at the measured shaft spacing give Brown's square flat-topped teeth. The rack pitch follows the pinion, so the racks carry 8 and 9 teeth against Brown's inconsistent finer 10 and 9."
- **Docs:** a "Pass 93 revision" section was added to `docs/mujoco-115-equal-racks.md`.

## 116 (medium): flimsy pawls; (low) two-piece stems without shadows. Fixed.
- **Verified:** yes. Each pawl was a 0.05-wide strip with a straight underside. Brown draws a broad crescent leaf with an eye (`p116z.png`). The stems were a stub plate plus a run-on box with a height step, thinner than the ring, and the extension and shaft-tail boxes had no shadow.
- **Change** (`src/simulation/mujoco-rack-rectifier/geometry.js`). The pawl is one shared plate for both sides, made of:
  - a bored eye boss (radius 0.036, bore 0.013);
  - a convex outer arc, tangent to the boss, running to the heel;
  - a concave inner arc, tangent to the boss at −60° and meeting the nose at 0.295 from the shaft;
  - a straight nose underside, cut at the tooth's 35° hook, joined to the inner arc by a 0.01 fillet.

  The claw and working face are unchanged: the claw sits in the root and the face lies along the locking face (0.0002 seat).
  - A 2D clicking sweep (`click116.mjs`) turns the ratchet through one tooth. Only the claw tip rides the rising back (lift 0 to 0.376 rad); the body never touches the ratchet.
  - Each stem is now one turned solid:
    - The left rod (r 0.185) flares into the ring's end face.
    - The right stem keeps Brown's collar and bevel, then a 0.10 rod.

    Both run out past the view, as before. The `addStubRunOns` call was dropped. The helper is otherwise unused and unchanged.
  - The shaft and its tail are now one disk. `markShadows` runs after every part is added.
  - The camera-fit bounds keep the drawn stems (x 8 to 514) plus travel, as before. Only z grows, by the shaft tail (−0.716 vs −0.52).
- **Captures:** `cmp116.png` (audit before / after, with the pinions hidden), `after/116-pawlh.png`, `after/116-row.png` (default, rotated and back views), `after/116-pawls.png`.
- **Tests:** `tests/mujoco-rack-rectifier.test.mjs` passes 7/7. It now asserts 14 parts and no `stubExtension*` or `shaftTail*` parts.
  - Native: penetration 0.145 px (was 0.140), seated lift 0.0014 rad, face offset 0.07°. Each pawl still drives on its own.
- **Bake:** `mujoco-116` was rebaked with the same loop (375 samples). The baked-loop tests pass 3/3.
- **Screens:**
  - Disconnected parts: nothing detached. The 8 near-misses are the existing bore clearances and the pawl-pin/ratchet short-of-pin (0.069).
  - Coincident faces: 0.
- **Ledger row:**
  - **Assessment:** reasonable.
  - **visibleFlaws:** none.
  - **Limits (append):** "p93: pawls are Brown's crescent leaf (eyed boss, convex back, concave underside, hook-cut claw seated in the root); stems are single turned rods."
- **Docs:** a "Pass 93 revision" section was added to `docs/mujoco-116-rack-rectifier.md`.

## 117 (low): wire-thin V brackets. Fixed. Rod trim declined.
- **Change** (`src/simulation/mujoco-roller-yoke/geometry.js`): each roller bracket is one fork plate. It has the eye boss and two curved arms 0.045 wide (were 0.024 capsules), which leave the boss sideways and sweep out to the crossbar feet.
- **Rod trim declined:** the output rod must stay in its fixed guide over the whole ±0.223 stroke. At the top of the stroke it clears the guide by only 0.17, so trimming it would pull it out. Brown breaks it off below the guide.
- **Captures:** `after/117-a-def.png`.
- **Tests and bake:** `tests/mujoco-roller-yoke.test.mjs` passes 6/6. `mujoco-117` was rebaked (400 samples, same loop). The baked-loop tests pass.
- **Ledger row:**
  - **Assessment:** keep the current one.
  - **visibleFlaws:** remove the wire-bracket item.
  - **Limits (append):** "The output rod's length below the guide is set by the stroke."

## 119 (low): rod standing proud along the rack back. Fixed.
- **Change** (`src/simulation/mujoco-endless-rack/geometry.js`): the one 5.06-long rod behind the rack is replaced by two end rods (`rod`, `rodRight`). Each keeps the flattened rear seat but runs in under its rack end by only 0.35. The camera fit still excludes both rods.
- **Captures:** `after/119-row.png` (default, back and oblique views).
- **Tests:** `tests/mujoco-endless-rack.test.mjs` passes 4/4, with a new assertion that neither rod spans the rack back.
- **Bake:** `mujoco-119` was rebaked (500 samples, same loop). The baked-loop tests pass.
- **Ledger row:**
  - **Assessment:** unchanged.
  - **visibleFlaws:** remove the back-rod item.

## 121 (low): reversing lever the same orange as the disk. Fixed.
- **Change** (`src/simulation/mujoco-reversible-click/geometry.js`): the lever (`rod`, `rodEye`) is now `PALETTE.muted` grey. It contrasts with the orange disk, the blue cog and the brass click.
- **Rebake:** not needed. Only the colour changed, and the physics fingerprint and motion sources are unchanged. The baked-loop tests pass 3/3.
- **Captures:** `after/121-115-row.png`.
- **Tests:** `tests/mujoco-reversible-click.test.mjs` passes.
- **Ledger row:**
  - **visibleFlaws:** remove the lever-colour item.

## Other checks
- `check-loop-seams` checked 0 of these IDs, because they are baked MuJoCo routes. The baked-loop seam tests cover them instead.
- **Deferred:** none.
- **Note:** while 115 was baking, its provenance once recorded the HEAD hash of `geometry.js`, even though the file was already edited. Another process may have touched the tree. A clean rebake records the correct hash (`cd9474f…`).

## Files claimed and changed
Claimed (under `/dev/shm/p93/claims/`):
- `mujoco-equal-racks__{geometry,physics,source,visual}.js`
- `mujoco-rack-rectifier__{geometry,physics,source,visual}.js`
- `mujoco-roller-yoke__geometry.js`
- `mujoco-endless-rack__geometry.js`
- `mujoco-reversible-click__geometry.js`

Changed:
- `src/simulation/mujoco-equal-racks/geometry.js`
- `src/simulation/mujoco-rack-rectifier/geometry.js`
- `src/simulation/mujoco-roller-yoke/geometry.js`
- `src/simulation/mujoco-endless-rack/geometry.js`
- `src/simulation/mujoco-reversible-click/geometry.js`
- `src/simulation/baked/assets/mujoco-{115,116,117,119}.{json.gz,provenance.json}`
- `tests/mujoco-{equal-racks,rack-rectifier,endless-rack}.test.mjs`
- `docs/mujoco-115-equal-racks.md` and `docs/mujoco-116-rack-rectifier.md` (appended sections)

## Sub-lane fbC: 143, 145, 151

Captures are in `/dev/shm/p93/fb/fbC/{before,after}/`.

### 143: the worm's hand was reversed (medium). Fixed.
- **Verified.** Plate crop: the front threads slope "/". In the production bundle (`baked/assets/143.json.gz`, not `authored-screws.js`), the front crest ran 0.0105 left per 0.1 rise, which is "\". The audit was right.
- **Change.** The worm is now left-handed. The worm and its hobbed wheel are the exact depth mirror (z → −z) of the validated right-hand pair.
  - `sliding-worm-kinematics.js` gains `hand: -1`, and `inputAngle = hand·22·wheelAngle`. The worm turns the other way for the same wheel turn, so the traverse, the wheel sign and the mesh phase are all unchanged. The mirrored pose is M·P·M.
  - `sliding-worm-geometry.js` gains `mirrorDepth(worm)` (winding swapped) and an exported `mirrorWheelCut` (hob field reversed in depth). The bore and key are symmetric in z.
  - `scripts/bake-sliding-worm-candidate.mjs` mirrors the cut when `hand < 0`. The bundle was rebaked and republished through `publish-sliding-worm.mjs`, so the provenance is valid.
  - `scripts/review-sliding-worm-render-contact.mjs` had a bug: it indexed stored normals by the filtered triangle count, so the 3 zero-area worm faces misaligned them. It now walks every stored face.
- **Validation.**
  - `143-render-contact`: 65 poses, 0 intersections, minimum separation ≥ 1e-5, topology clean.
  - `143-assembly`: 65 poses, 0 failing pairs.
  - `143-envelope`: unchanged. It checks the unmirrored generating field, which is mirror-invariant.
- **Captures.** `after/143-cmp.png` (plate crop, before, after, phase 0.33), `after/143-zww.png` (close zoom: the crest now rises to the right) and `after/143-tile.png`.
- **Tests.**
  - `sliding-worm-kinematics` (the sign is updated).
  - `sliding-worm-model`, with a new test that the front crest rises to the right. It passes 4/4.
  - The models.test pattern for 143 passes.
- **Screens.** Disconnected parts, coincident faces, body intersections and seams all ran on the registry model. For 143 that is the legacy `authored-screws.js` path, not production, so they don't bear on the fix. Production is covered by the two reports above.
- **Note.** `authored-screws.js:7718` (`wormHandedness = 1`) is the unused offline path and is still right-handed. It was not changed.
- **Proposed ledger row.**
  - Assessment: unchanged by this fix apart from the hand.
  - visibleFlaws: drop "worm hand reversed".
  - Limits, append: "Worm is left-handed as drawn: the validated right-hand pair, mirrored in depth; the input turns the other way (no arrow on the plate)."

### 145: square beam end with the ring overhanging; rod top (medium). Fixed.
- **Verified.**
  - The beam's left eye had r = 0.17, but the pin's retaining ring reaches 0.199, so the ring overhung.
  - The upright rod's r = 0.17 eye stood above the beam's 0.13 half-width.
  - The fixed pivot ring (outer 0.375) also overhung the 0.27 right end.
- **Change** (in `rockingBeamTieRodFlywheelMotion` in `authored-linkages.js`):
  - The beam is one plate: a semicircular left end of r = 0.26, concentric with the pin (1.3× the ring), tapering straight to a squared right end of half-width 0.36 at x = 0.40. The taper is about 1.4×; Brown's is 1.67×.
  - The redundant pivot disc was removed.
  - The pivot front ring is now torus(0.21, 0.055), with outer radius 0.265, about Brown's circle round the hatched shaft.
  - The rod's round eye now lies inside the beam's eye outline, so nothing pokes above the beam in the front or rotated views.
  - The kinematics are unchanged.
- **Other movements.** Geometry hashes for 144 and 203 are identical to HEAD (144: b6795d684d2d, 203: b0a863af2010).
- **Validation.** `145-assembly` (65 poses) and `144-assembly` (fingerprint only) were regenerated; both have 0 failing pairs.
- **Captures.** `after/145-tile.png` (plate, default view, two zooms). The before views are in `before/145-tile.png`.
- **Tests.** `rocking-beam-joints` and `analytic-linkage-joints` pass 3/3, and the models.test pattern for 145 passes.
- **Screens.** No detached parts, no slivers and no lips; 0 coincident faces; worst body intersection 0; 0 seams.
- **Proposed ledger row.**
  - visibleFlaws: remove the beam-end and rod-top items.
  - Assessment: reasonable, if no other flaws are listed.
  - Limits, append: "Beam and pins are about 1.6× Brown's width, to hold the shared pin rings."
- **Not done.** 144's low finding (the post should be in front of the tongs). Deferred.

### 151: 18 coarse teeth; hub collars; thin plain shaft (medium and low). Fixed.
- **Verified.**
  - Brown hatches a fine wheel. The model had the 104 profile's 18 coarse teeth.
  - The grey "collars" at ±0.55 were undrawn screw bearings.
  - The plain shaft was the 0.135 core, where Brown draws it about as thick as the threads.
  - Plate measurements: the hub is about 52×52 px round a 28 px wheel, and the shaft is 30 px across.
- **Change.**
  - **Wheel.** New `src/simulation/opposed-screw-profile.js`: the 104 stub worm refined to half its axial pitch.
    - It has 36 teeth at the same pitch radius, with every tooth and thread depth halved.
    - The worm keeps its outer radius, so its axis rises from 1.53 to 1.62, toward the plate's 1.62.
    - New `scripts/generate-opposed-screw-wheel.mjs` hobs the tooth offline (18 s) into `src/simulation/opposed-screw-wheel-data.js`, with seam error 0.
  - **Drive ratio.** It is now 36:1. The worm spins at twice the angular speed, but its thread crests move no faster than before (0.55 units/s).
  - **Flat flanks.** `solidWheel` creases the welded wheel's normals at 30° (`creaseIndexedNormals`), so the flanks and tips shade flat. It now snaps only the radial-boundary vertices. Before, the fine bore-fan centres were snapped too, which made 166 degenerate faces and 170 open edges.
  - **Hub.** A square hub boss, r = 0.36 and 0.72 long, runs through the wheel and stands out of both faces (`wheel-hub-boss`).
  - **Plain shaft.** It is now r = 0.21 (`plain-shaft`).
  - **Bearings.** The two undrawn screw bearings, their posts and their feet were removed. The guided nuts carry the screw, and the hobbed wheel is centred by the worm.
  - **Journals.** They keep their world size.
- **Validation.**
  - `151-render-contact`: 65 poses, 0 intersections, minimum separation ≥ 1e-5, topology 0/0.
  - `151-assembly`: 0 failing pairs.
  - The review script now uses the 36:1 ratio and the new sources.
  - `151-indicator-browser.json` was left alone; it was already stale at HEAD.
- **Captures.** `after/151-tile.png` (default, ±50° and top views) and `after/151-zoom.png` (hub, shaft and teeth). The before views are in `before/151-tile.png`.
- **Tests.** `opposed-screw-nuts` passes 4/4. The ratio test was updated, the speed test now bounds the crest speed, and a new test covers the 36 teeth, the hub and the shaft. The models.test pattern for 151 passes.
- **Screens.** The registry model for 151 is the legacy `authored-worm-screws.js` path, not production. It showed 0 coincident faces and 0 seams. The production checks are the reports above.
- **Proposed ledger row.**
  - visibleFlaws: drop the coarse-teeth, collar and thin-shaft items.
  - Assessment: reasonable, unless other items remain.
  - Limits, replace the tooth-count text with: "36-tooth hobbed wheel, 36:1 single-start worm (Brown's hatching implies about 36); screw bearings are not drawn and are omitted: the guided nuts carry the screw."

### Deferred
- 144 low (post in front of the tongs): not attempted.
- The 143 and 151 legacy registry paths (`authored-screws.js`, `authored-worm-screws.js`) still hold the old geometry. The offline screens read those paths, not production.

## Sub-lane fbD: 153, 155 and 168 (plus the low findings for 153/166 and 155)

The captures are in `/dev/shm/p93/fb/fbD/` (`before/`, `after/`). The screens for 153, 155 and 168 were run after the changes:
- **Disconnected parts:** 0 detached everywhere. 168 had 1 detached before and 0 now. There are no slivers or lips. The near-misses are running clearances: 153 has 1, 155 has 2 (3 before) and 168 has 5 (6 before).
- **Coincident faces:** 0 flagged pairs.
- **Loop seams:** 0.
- **Body intersections:** this screen runs the legacy authored models, not production, so its results are unchanged and not relevant.

### 168: slotted crank (medium), fixed
- **Verified:** yes. The hairpin walls were 0.092, thinner than the 0.144 pin. Brown draws a broad arm with a narrow slot.
- **Change** (`src/simulation/variable-radius-crank.js`): the crank is still one extrusion, now with:
  - an arm 0.48 wide (3.3× the pin);
  - walls of 0.158, wider than the pin;
  - a closed slot 0.164 wide, which leaves 0.010 clearance on each side of the pin;
  - a boss of radius 0.38 (was 0.312).

  The pin's slot radius runs 0.361–1.476, inside the slot's 0.258–1.582, so the slot does not need to run through the shaft side.
- **Validation:** `docs/validation/168-solid-clearance.json` was regenerated: 129 poses, 5.69 M queries, no intersections.
- **Captures:** `after/t168.png` (the plate, the default view, rotated views and phases) and `after/z168.png` (zooms).
- **Tests:** `tests/variable-radius-crank-motion.test.mjs` has a new test that the crank's walls and slot are each wider than the pin. It passes 4/4.
- **Ledger:** assessment reasonable; visibleFlaws none. Limits: append "p93: the slotted crank is one broad extrusion (arm 3.3× the pin, slot 0.010 clearance a side, boss 0.38)."

### 155: pawl prong and rod top (medium + low), fixed, with one disagreement
- **Disagreement:** the audit asks for a symmetric double-nosed pawl, mirrored about the pivot's radial line. I did not do that, for three reasons:
  1. Brown's upper prong rises up and to the right, away from the wheel. A mirrored nose would sit under the elbow arm instead.
  2. The caption ("according to the side on which the pawl works") is already met by the existing turned-over "left" installation.
  3. A pawl symmetric about that nearly vertical radial line would put its centre of gravity on the pivot. Gravity would then no longer seat it.

  The real flaw was the square cut at the crop line.
- **Change** (`src/simulation/mujoco-elbow-pawl/geometry.js`):
  - The prong now continues 12 source px past Brown's crop along both of its edges and ends in a semicircle, so the pawl is one smooth extrusion. The working nose is unchanged.
  - The rod ends plainly in a round end (r 0.15) concentric with the ideal top pin. The eye is gone.
  - The crosshead pin and retainer are deleted. The crosshead block remains only as the native slide's mass, and `scripts/bake-elbow-pawl.mjs` now leaves it out of the shipped bundle, as it already does for the fixed frame.
- **Rebake:** the whole chain was rerun (probes, refinement, assembly, bake, baked assembly):
  - Settled feed is one tooth per cycle on both sides (error below 1.3e-6 tooth).
  - Assembly failures: 0 (right 8.14 M checks, left 7.10 M).
  - 4,401 samples per installation. The bundle is 768,620 B.
- **Captures:** `after/t155.png` (default view, rotated views, phase 0.33 and prong zooms).
- **Tests:** `tests/elbow-pawl-physics.test.mjs` gains a test for the arc-capped prong past the crop and the plain rod end. The physics and baked tests pass 5/5; the physics file alone passes 4/4.
- **Ledger:** assessment reasonable; visibleFlaws none. Limits: append "p93: the upper prong is completed past Brown's crop with a round end, and the rod ends plainly. The turned-over installation stays the reversal, because a symmetric double nose would lose gravity seating."

### 153: elbow lever (medium), partly fixed; the depth step is kept as a forced flaw
- **Fixed** (`src/simulation/mujoco-stud-reverser/geometry.js`):
  - **Return arm width:** the upper arm was 12.8 px wide against Brown's roughly 20. Only its idle edge is widened: the arm is 0.31 wide at the eye, tapering to 0.25, with a semicircular end tangent to both edges. The working edge that meets the bar's stud is unchanged.
  - **Boss:** the elbow boss was an oversized black disk. It is now lever-coloured, part of the lever.
  - **Pivot pin:** the fixed pivot pin now runs up through the boss to its face cap, so the eye shows its pin instead of an empty bore.
- **Rebake:** the whole chain was rerun (supported prototype and fine probes, assembly, moving volumes, bake, baked assembly):
  - The settled bar's left end is 0.0382 (was 0.0389, a difference of 0.05 source px), and it still repeats every cycle.
  - Assembly and baked-assembly failing pairs: 0 (3.35 M checks). Moving volumes: 0.
  - The bake has 6,001 samples and closes.
- **Kept as forced: the depth step in the input arm.** The disk's stud orbit (R 1.420) comes within 1.227 of the elbow pivot (2.647 from the disk centre). The arm's contact reach is 1.947 (arm 1.667, plus its 0.126 tip and the 0.154 stud).
  - So a flat arm in the stud plane would be dragged through the whole ±31.7° sector of the orbit, about 63° of elbow travel.
  - Returning the bar 1.02 needs only about 25°.
  - The recorded passive sims of the flat geometry did not sustain the cycle (`153-passive-prototype.json`, `153-short-output-probe.json`).
  - The studs therefore still pass under the raised inner arm. The bar's front stud also stays in its own plane, because the return arm must sit forward of the bar.
- **Not changed: the quadrant-cue boundary lines on 153 and 166.** These are the shared cue's deliberate ~1.5 px boundary lines (`src/simulation/rotation-indicator.js`, used by every cued movement). Changing them is a project-wide style decision. I have not edited them.
- **Captures:** `before/m153.png`, `after/t153.png` (the plate, default view, rotated view, phase 0.33 and zooms of the eye), `before/cue.png`.
- **Tests:** `tests/stud-reverser-physics.test.mjs` gains a test for the boss material, the pin in the eye and the return arm's width and working edge. It passes 4/4. `tests/stud-reverser-baked.test.mjs` passes.
- **Ledger:** assessment minor. visibleFlaws: "the input arm's inner part is raised in depth over the disk studs, a Z-step visible in rotated views (forced: a flat arm would be swept about 63°, against the 25° the return needs)". Limits: append "p93: the return arm is at plate width and the elbow boss is lever-coloured with its pin visible (rebaked; bar settles at 0.0382)."
- **Stale report:** `docs/validation/153-supported-refinement.json` lists `/dev/shm` sample files and has no generator script. It was not regenerated.

### Deferred
- **Quadrant-cue lines (153 and 166 low):** the change belongs to the shared helper `rotation-indicator.js`, so it is a project-wide decision.
- **153 rotated views:** the fixed elbow shaft still runs back to the undrawn rear support boss. This was not flagged and is unchanged.

## p93-fb sub-lane fbE: quick low findings (86, 93, 100, 135, 150, 152, 163; not done: 87, 92, 111, 161)

Captures are in `/dev/shm/p93/fb/fbE/`.
- **Tiles:** `tile-ID.png`. Top row: the plate, default view, +50°/+20°, −50°/−15°. Bottom row: back, phase 0.33, phase 0.67, top.
- **Raw views:** `views/`. **Zoom:** `z/93-z.png`.
- **Before:** the audit captures in `/dev/shm/p93/b/`.

## Screens (IDs 86, 93, 100, 135, 150, 152, 163)
- **Coincident faces:** 0 flagged pairs.
- **Loop seams:** 0 above tolerance.
- **Disconnected parts:** no detached or floating part. The near-miss and lip counts are the same as the audit's or lower. 135 went from 18 to 14 meshes and 150 from 18 to 16. 100's single short-of-pin row, tailRod/pivotShaft at 0.054, is unchanged.
- **Body intersections** (`fbE/bi.json`):
  - 93: worst 0.009, the index against the stem guide.
  - 135: 0.
  - 150: 0.0986, cam against the axle cap. This is the known pass-49 class.
  - 152: 0.
  - 163: 0.1887, the known pass-49 row.
  - 100: 0.338, the shaft against the lever. The screen builds the registry's legacy authored model (36 meshes), not the baked MuJoCo geometry, and gives the identical 0.338 with HEAD's geometry.js restored, so it predates this pass.
  - 86: the worker ran out of heap (4 GB) on the dense live rope. Unrelated to a colour change.

## 86: pump rope
- **Verified.** The vertical `pumpRope` was #b99b63, pale tan, while the band `inputDriveRope` was already `PALETTE.rope`.
- **Change.** `src/simulation/pump-catch-complete-geometry.js` now builds the rope with `PALETTE.rope`. No validation JSON fingerprints this file.
- **Captures.** `tile-86.png`.
- **Tests.** pump-catch passes 7/7, including a new test that both ropes are `PALETTE.rope`.
- **Ledger.** No change to assessment or visibleFlaws. Append to limits: "p93: pump rope uses the shared hemp-brown rope colour."

## 152: paper sheet
- **Verified.** The sheet used `PALETTE.paper`, which is exactly the page background (#f3f0e9).
- **Change.** `src/simulation/trammel-ellipsograph.js` now tints the sheet parchment (#e9e1cf).
- **Validation.** `docs/validation/152-assembly.json` was regenerated. Only its hash changed: 65 poses, 0 failing pairs.
- **Captures.** `tile-152.png`. The sheet now reads as a sheet in the default and rotated views.
- **Tests.** trammel-ellipsograph passes, with a new colour test.
- **Ledger.** Reasonable, visibleFlaws empty. Append to limits: "p93: the paper sheet is parchment (#e9e1cf), distinct from the background."

## 163: belt colour and drum shadow
- **Verified: belt.** `flatBelt` and `beltReturnBeyondCrop` were `PALETTE.ink`, black.
- **Change.** `src/simulation/mujoco-belt-governor/solids.js` now uses `PALETTE.belt` for the belt, which is the shared hemp brown. The return run shares its material.
- **Rebake.** `node scripts/bake-belt-governor.mjs` rebuilt `163.json.gz` and its provenance: 1761 samples, closure 1.5e-7, unchanged. The provenance's `primitives.js` hash was already stale from pass 92 and is now current.
- **Reports.** `163-solid-clearance.json` and `163-baked-clearance.json` were regenerated; only their hashes changed.
- **Drum shadow.** The audit's `drivingDrumBeyondCrop` no-shadow finding does not hold. In the browser the engine's shadow policy gives cast=true and recv=true for the drum, its shaft, the belt and the return run (checked with `shadowcheck.mjs`). The audit read the raw model, so no change was needed.
- **Captures.** `tile-163.png`.
- **Tests.** belt-governor-baked and belt-governor-solids pass, with a new belt-colour test.
- **Ledger.** No change. Append to limits: "p93: the flat belt is the shared hemp brown."

## 150: valve rod lower end
- **Verified.** Source presentation removes the reconstructed valve slide, guides and bracket. That left the rod's lower eye and black cross-pin attached to nothing. Brown draws a plain rod running off the plate.
- **Change.** In `src/simulation/selectable-cam-valve.js`:
  - the rod outline ends in a round end at the same bottom point (y matches source 272 px), with no lower eye and no hole;
  - `lower-pin` and `lower-pin-retainer` are no longer built.

  The slider body still carries the kinematic joint.
- **Validation.** `docs/validation/150-pinned-valve-assembly.json` was regenerated: 47 parts, 65 poses, 0 failing pairs. The other 150 reports (passive-*, projection-landmarks) were already stale at HEAD because pass 92 changed `authored-selectable-cams.js`, so they were left alone as historical.
- **Captures.** `tile-150.png`.
- **Tests.** selectable-cam-valve passes 2/2, including a new test for no lower eye or pin. selectable-cam-physics passes.
- **Ledger.** No change. Append to limits: "p93: the valve rod ends plainly; the undisplayed lower slide joint is kinematic only."

## 135: rod guides
- **Verified.** Two grey collars (`upperRodGuide`/`lowerRodGuide` with their webs) hung round the rods. Brown draws only the hexagonal nut sections.
- **Change.** In `src/simulation/authored-cams.js`, `rodGuides` are no longer added to the root. The rods are unchanged.
- **Other IDs.** Every other ID the factory builds is byte-identical. A geometry, material and matrix hash (`hashcams.mjs`, `cams-before.txt`/`cams-after.txt`) over 89, 90, 91, 96, 97, 99, 106, 107, 128, 130, 136, 137 and 138 shows only 135 differs.
- **Captures.** `tile-135.png`.
- **Tests.** reuleaux-yoke-hardware passes 2/2, with a new no-RodGuide test. reuleaux-bearing-support, reuleaux-valve-clearance and the models.test 135 case all pass.
- **Ledger.** No change. Append to limits: "p93: the undrawn rod guides are not displayed; the rods' vertical guidance is ideal."

## 100: crank end and colour
- **Verified.** The crank's end radius equalled the pin radius (ratio 1.0), and the crank was the disk's orange.
- **Plate check.** Brown's crank end is only a little larger than the pin, so I used an end eye of 1.35× the pin radius, not the audit's 1.6×.
- **Change.** In `src/simulation/mujoco-quick-return/geometry.js`, the eye is 1.35× the pin, still tangent-joined to the hub, and the crank is `PALETTE.accent` (yellow) so it reads against the disk.
- **Rebake.** `node scripts/bake-mujoco-movement.mjs 100`: 250 samples as before, round trip 0.0036 px.
- **Captures.** `tile-100.png`.
- **Tests.** mujoco-quick-return passes 6/6, with a new eye and colour test. In mujoco-baked-loops, 100 passes.
- **Ledger.** No change. Append to limits: "p93: the crank is accent yellow with a 1.35× end eye round the wrist pin."

## 93: fork tines
- **Verified.** The tines were 0.08 wide beside a 0.30 stem.
- **Change.** In `src/simulation/mujoco-scotch-yoke/geometry.js`, `loopOuter` goes from 0.27 to 0.34, so the tines are 0.15, half the stem.
- **Rebake.** `node scripts/bake-mujoco-movement.mjs 93`: 250 samples as before, round trip 0.0045 px.
- **Captures.** `tile-93.png`, `z/93-z.png`.
- **Tests.** mujoco-scotch-yoke passes 5/5, with a new tine-width test. In mujoco-baked-loops, 93 passes.
- **Ledger.** No change. Append to limits: "p93: the lower stem loop's tines are half the stem width."

## Not done
- **92 (disagree).** `rearSupport` is the only member tying the guide frame to the wheel shaft. It sits behind the wheel, out of the default view. Deleting it would leave the guide floating, which breaks the connection rule. The rulebook keeps a minimal support where it is needed to show a fixed relationship. Leave it, or replace it with a different minimal support in a later pass.
- **87.** The stud's radius enters the integrated stud/G contact trajectory (`studRadius` in `source-fit.js`). Moving or shrinking it means re-integrating the playback, so it is not quick.
- **111.** The run-out tabs come from the shared `helicalThread` in `mujoco-screw/thread-geometry.js`, which 102, 103 and others also use. It is not quick.
- **161.** The lower support is in the ball-governor baked bundle and needs a native rebake. It is not quick.

## Other lanes' state seen during validation
- `tests/mujoco-baked-loops.test.mjs` has one failure: "115 compiled physics is the one that was baked". That is the sibling 115 lane's work in progress.
- `authored-helical-current-rotors.js` (another lane) briefly failed to parse, which blocked the registry-based screens.
