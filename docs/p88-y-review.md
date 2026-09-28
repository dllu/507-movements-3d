# Pass 88, lane p88-y: coincident-face flicker (36, 170, 190, 199, 220, 300, 301, 311, 320, 326, 327, 373, 383, 402, 413, 447, 471, 486, 500)

Reviewer: Claude Opus 5.5, lane p88-y. Date: 2026-09-27.

Scratch files and captures are in `/dev/shm/p87/p88-y/`, outside Git.

- **Screens:** `before.json` and `after.json`, from `node scripts/screen-coincident-faces.mjs --ids=36,170,190,199,220,300,301,311,320,326,327,373,383,402,413,447,471,486,500`.
- **Aimed captures:** `before/` and `after/`, from p88-x's `verify.mjs` on the before rows (`rows-before.json`, every pair of area ≥ 2e-5 × diag²). `ID-k-both.png` is zoom 5 and `-both2.png` is zoom 15, aimed at the pair's peak patch. The visibility probe (`vis.mjs`, 10 views) is in `before/vis.log`.
- **Before/after tiles:** `ba1.png` to `ba5.png`. The columns are before z5, after z5, before z15, after z15.
- **Default and rotated views:** `v1.png` to `v4.png`. The columns are before, after, before rotated 35°/15°, after rotated. The before views come from a second dev server on a copy of the working tree in which only this lane's files were restored from HEAD (`base/`).

## Screen, before → after

Areas are × diag². "Views" is how many of the 10 probe views see the peak patch.

| ID | Before | After |
|---|---|---|
| 36 | 1 fight, 2.9e-3 (latent, 8 views) | 0 |
| 170 | 1 fight, 3.0e-4 (6 views) | 0 |
| 190 | 2 fights, 1.9e-3 (hidden, 0 views) + 4.7e-4 (3 views) | 0 |
| 199 | 10 fights, 3.5e-3 in total | 0 |
| 220 | 1 fight, 9.0e-4 (8 views) | 0 |
| 300 | 2 fights, 1.5e-4 each | 0 |
| 301 | 2 fights, 1.2e-4 each | 0 |
| 311 | 2 fights, 3.3e-4 each | 0 |
| 320 | 1 fight, 5.8e-4 | 0 |
| 326 | 2 fights, 1.4e-3 each | 0 |
| 327 | 3 fights, 6.0e-4 in total | 0 |
| 373 | 1 fight, 1.1e-3 | 0 |
| 383 | 13 fights, 2.2e-2 in total | 0 |
| 402 | 28 fights, 3.7e-4 in total | 0 |
| 413 | 4 fights, 5.8e-3 in total | 0 |
| 447 | 4 fights, 9.0e-4 in total | 0 |
| 471 | 1 fight, 1.5e-4 | 0 |
| 486 | 3 fights, 3.8e-3 in total | 0 |
| 500 | 10 fights, 1.1e-2 in total | 0 |

There were no seams in any of these IDs. No flags remain, so there are no false positives to explain. Every hidden pair in the before screen was fixed along with the visible ones.

## Per ID

### 373: test load heap (`authored-rolling-friction-experiments.js`)

- **Cause.** The heap's flat stone bases lay in the wagon bed's top face.
- **First try.** The heap was sunk 0.006 into the bed. `roller-working-solids` rejects that penetration, so this was dropped.
- **Fix.** The heap stands `baseLift` = 0.003 above the bed (`testLoadHeap.baseLift`), as the fixed stones already do. Its law is otherwise unchanged.
- **Captures.** `ba1` row 1.
  - Before: the heap's base speckled through the bed top.
  - After: the heap, which is still nearly flat at this light load, renders as a clean patch.
- **Test.** `movement-373` checks the new seat.

### 220: output shaft (`authored-offset-crank-slots.js`)

- **Cause.** The output shaft's end cap was flush with the hub's front face and showed as a radial hatch.
- **Fix.** The shaft now ends 0.0156 inside the hub (`endZ` changed from -0.165 to -0.180625). The shaft length, 1.734375, keeps its half-length exact in float32; with -0.175 the far end rounded 5e-9 past the swept framing bound and `coupling-clearance` failed.
- **Captures.** `ba1` row 2.
- **Test.** `movement-220` checks the shaft end.

### 190: power screw and nut (`authored-clamps.js`)

- **Screw core.** The core now stops 0.01 below the top of the handle hub (`screwCoreLocalMaximumY` = handle + 0.08). This removes the radial hatch on the hub top (`ba1` row 3).
- **Nut.** The hidden pair is fixed too. The nut lies wholly inside the drilled lower arm, and it is now bored 0.004 wider than the arm, so the arm's bore alone carries the thread.
- **Test.** `movement-190` checks the core end.
- **Stale reports.** `docs/validation/174-*` and `180-*` fingerprint `authored-clamps.js`, but none of their hashes matched HEAD before this pass. They were not regenerated.

### 471: crank pin A (`authored-atmospheric-hammers.js`, 471 factory only)

- **Cause.** The shared hammer helper ended the pin flush with the crank arm's back face.
- **Fix.** After the helper runs, the pin is rebuilt 0.39 long, so that it ends 0.01 inside the arm. `hammer-working-parts.js` is not touched.
- **Captures.** `ba1` row 4.
- **Test.** `movement-471` checks the pin end.

### 311: fan-fly crossarm (`authored-gravity-escapements.js`, 311 builder)

- **Cause.** The crossarm ran on to each vane's centre, and its 0.075 faces lay in the vane's faces.
- **Fix.** The crossarm now ends on each vane's inner edge.
- **Captures.** `ba2` row 1.
- **Test.** `movement-311` checks where the crossarm ends.
- **Baked plates.** The 311 entry of `baked/gravity-escapement-plates.js` was regenerated (`node scripts/generate-gravity-escapement-plates.mjs 311`), because its input fingerprint covers the fly. Only `inputHash` changed; all six plate outlines are identical, and 309, 310 and 312 are byte-identical.

### 300, 301: impulse flanges (`authored-escapements.js`, Debaufre builder)

- **Cause.** Each flange's end walls were coplanar with the band's end walls. The band's carved top also lay only 0.002 under the flange's carved top, and on the steep carved faces that is within z-fighting distance.
- **Flange end walls.** They now stand 0.002 inside the band's. The rest face at `palletX0` is unchanged.
- **Band top.** Under the flanges it is now sunk 0.005 (it was the baked 0.002 skin). It lies wholly inside the flange.
- **Captures.** `ba2` rows 2 and 3: the speckled flange face is clean.
- **Test.** `debaufre-300-301-working-solids` checks the inset.

### 170: fork bridge (`mujoco-crossed-governor/solids.js`)

- **Cause.** The fork bridge (0.58 deep) ran through both fork plates.
- **Fix.** It now spans only between the plates' inner faces (0.42 deep).
- **Rebake.** The bundle was rebaked from the unchanged native cycle (`/dev/shm/170-settled-cycles.json`, hash `08e32daa…`, which matches the provenance): 481 samples, midpoint error 9.6e-6.
- **Provenance.** It is valid: every source hash matches.
- **Reports.** `170-solid-clearance.json` and `170-baked-solid-clearance.json` were regenerated with 129 poses, with no intersections and nothing unexpected. Only their hashes changed.
- **Captures.** `ba2` row 4.
- **Test.** `crossed-governor-baked` checks the bridge.

### 320: ratchet on pulley p (`maintaining-clock-parts.js`, `correctEndlessMaintainingChain`, which only 320 uses)

- **Cause.** The ratchet and the hub shared the 0.132 bore wall.
- **Fix.** The ratchet is bored to the hub radius (0.19), and the hub runs on through it to stand 0.01 proud of its front face.
- **Visible change.** A dark hub face now shows at the ratchet centre (`v1` row 1; `ba3` row 1).
- **Shared helpers.** `ratchet()` and `makeFollower()`, which `polishing-joint-parts` shares, are unchanged.
- **Test.** `maintaining-clock-interfaces` checks the bore and the hub.

### 402: balance pinions and sectors (`guernsey-working-parts.js` and `authored-guernsey-escapements.js`, both 402 only)

- **Upper hub.** It ends on its pinion's back face; it used to run 0.06 into the pinion's bore.
- **Left pinion.** The left hub runs right through its pinion, so that pinion is bored to 0.13, inside the hub.
- **Sector bodies.** They are 0.002 thinner on each side than their teeth, whose roots they overlap.
- **Arbors.** Both fixed arbors end 0.005 inside the see-through bridge's front face instead of flush with it.
- **Captures.** `ba3` row 2.
- **Test.** `guernsey-working-solids` checks all of these.

### 199: lantern pinion (`authored-gears-core.js` 199 builder, and `partial-lantern-rack-parts.js`, 199 only)

- **Side plates.** They are bored to the hub radius (0.16); the 0.05 hub runs through the 0.042 plate.
- **Spokes.** Their centre holes are 0.12, which lies inside the hub.
- **Guide-roller drums.** Their bore is 0.07, inside the 0.0795 roller hubs.
- **Captures.** `ba3` row 3.

### 413: V flanks and nut collar (`friction-family-working-parts.js`, `correctFriction413` only; and `authored-adjustable-friction-gears.js`)

- **V flanks.**
  - Cause: the rendered rigid flanks were the unloaded rubber's exact cone, and their facets lay in the rubber's along the contact line.
  - Fix: they now stand 0.005 radially inside that cone (`geometry.renderedGrooveRelief`), and their outer ends stop 0.003 short of the rubber's end planes.
  - The crank-handle stem is 0.003 longer so that it still meets the left flank.
- **Nut collar.** It lay wholly inside the hex nut and repeated its bore and end faces (a hidden fight), so it is no longer drawn.
- **Captures.** `ba3` row 4.
- **Test.** `friction-family-working-solids`: the unloaded rubber-to-flank gap is 0.003–0.006.

### 326: planed guide strips (`authored-steam-engine-guides.js`)

- **Cause.** The dark strips shared the slot wall and the frame's front face.
- **Fix.** Each strip is set 0.003 back from the slot wall into the frame and stands 0.003 proud of the frame front. The frame's slot wall is now the sliding face, and the contact pair is unchanged.
- **Captures.** `ba4` row 1.
- **Test.** `movement-326` checks the offsets.

### 36: mangle wheel rim ring (`authored-gears-core.js`, `mangleWheel`)

- **Cause.** The ink rim ring was a flat ShapeGeometry lying 0.0002 above the face.
- **Fix.** It is now a 0.004 extrusion standing on the face.
- **Captures.** `ba4` row 2.
- **Test.** `mangle-contact` asserts that no visible ShapeGeometry remains.

### 447: ferry (`reaction-ferry-parts.js`, 447 only; and `authored-reaction-ferries.js`)

- **Deck.** It stands on the hull's top face; it used to sink 0.03 into it, with coplanar well walls. The deck's top is unchanged.
- **Stock bearing.** It hangs from the hull band's lower face instead of running up into the band's stock hole.
- **Water.** The water's cropped ends stand 0.004 inside the banks'.
- **Visible change.** Each well now shows the hull band's wall (orange) below the deck's (yellow) (`ba4` row 3).
- **Test.** `cock-ferry-working-solids` checks all three.

### 327: guide columns and gland (`authored-steam-engine-guides.js`)

- **Guide columns.** Each column's inner face stands 0.003 behind its strap's working edge, so the strap alone carries the contact line.
- **Stuffing box.** It starts on the cylinder cap's top face instead of sharing the cap's rod bore.
- **Captures.** `ba4` row 4.

### 383: cloth web (`authored-textile-dressing.js`)

- **Cause.** The zero-thickness web lay in the roll bodies and on the brush-bar tips (0.0002).
- **Fix.** The roll bodies and brush tips now stand 0.002 under the web's path. The path, speeds and slip are unchanged.
- **Captures.** `ba5` rows 1 and 4.
- **Test.** `textile-planer-working-parts` checks that the gaps lie in 0.0015–0.0023 (rolls) and 0.0015–0.003 (brushes).

### 500: section view (`authored-diaphragm-pressure-gauges.js`)

- **Cause.** Every part of the section is a double-sided half solid, closed by cut faces on one plane.
  - Parts that merely touched showed both faces at one depth.
  - Parts of different materials that overlapped showed two cut faces in one plane.
- **Joints of one material.** These are the case and ring, the case and nipple, the pipe and foot, and the disk and boss. Each now overlaps by 0.5 plate px, so the touching faces lie inside the other part and the two cut faces look the same.
  - The nipple's bore is 0.3 px wider than the case's hole.
  - The foot's bore is 0.3 px wider than the pipe's.
- **Pockets.** The disk rim sits in a pocket in the clamp ring, and the glass and dial rims sit in pockets in the case. Each pocket is 0.1 px larger than the part it holds.
- **Small parts.** The lug runs 0.3 px into the boss; the lug pin ends inside the lug; the spindle ends inside the pointer hub.
- **Captures.** `ba5` row 2 and `v4`.

### 486: rotor boss and lower bearing (`wind-rotor-working-parts.js`, the 486 branch only)

- **Square boss.** It stands on the hub's top face (y 0.155) instead of sinking into the hub's bore. Its top is unchanged.
- **Lower bearing.** It seats on the cross supports' top face.
- **Other movements.** 484 and 485 are unchanged.
- **Captures.** `ba5` row 3.
- **Test.** `wind-rotor-working-interfaces` checks both seats.

## Checks

- **Coincident-face screen.** All 19 IDs show 0 fights and 0 seams (`after.json`).
- **Other movements unchanged.** Every movement was built and hashed: mesh positions, indices, visibility and world matrices at two times.
  - Compared: the working tree against a copy with only this lane's files restored from HEAD (`hash.mjs`, `hash/`).
  - Result: only this lane's 18 registry-built IDs differ. 170's registry model is unchanged; its production bundle is the rebaked one. The other 488 movements are byte-identical.
  - This comparison predates two later fixes: 373's lift and 220's shaft length. Both are confined to those movements' own factories.
  - This covers the shared files: `authored-gears-core.js`, `authored-escapements.js`, `authored-gravity-escapements.js`, `authored-clamps.js`, `maintaining-clock-parts.js`, `friction-family-working-parts.js` and `wind-rotor-working-parts.js`.
- **Disconnected parts.** Before and after:
  - Detached, floating, slivers and lips: identical for all 19 IDs.
  - Near-misses fell for 413 (7 → 6, the hidden collar) and 447 (13 → 12, deck × bearing).
  - Near-misses rose for 199 (20 → 28) and 402 (37 → 38). Every new pair is a plate or pinion whose enlarged bore now lies inside its own hub, reported against the shaft; the hub in the same rigid body carries it.
- **Body intersections.** 413's and 500's worst depths fell slightly. 320 runs out of memory in the screen both before and after (a pre-existing problem).
- **Loop seams.** `check-loop-seams`: 19 checked, 0 seams, 0 pops, 0 errors.
- **Validation reports.** These were regenerated with their original pose counts: `170-solid-clearance`, `170-baked-solid-clearance`, `170.provenance.json`, `191-196-201-contact` (513), `200-226-bevel-solids` (33) and `202-264-worm-solids` (33). Only their source hashes changed, and all of them now match the tree.
- **Tests.**
  - Targeted: every `movement-*` test for these IDs, plus `mangle-contact`, `crossed-governor-baked`, `clamp-*`, `partial-lantern-*`, `debaufre-300-301-working-solids`, `maintaining-clock-*`, `engine-guide-solids`, `textile-planer-working-parts`, `guernsey-working-solids`, `friction-family-working-solids`, `cock-ferry-working-solids`, `hammer-working-interfaces`, `wind-rotor-working-interfaces` and `elastic-gauge-working-solids`. All pass.
  - Full suite (`node --test tests/*.test.mjs`, working tree with the other lanes' edits): 4605 tests, all passing. The first run had 3 failures, all in this lane: 220 framing, 373 heap penetration, and the stale 311 plate hash. All three were fixed as described above.
- **Routes.** No factory changed which IDs it handles, so the routes were not regenerated.

## Proposed ledger rows

Each row keeps its existing assessment. No visible flaw was introduced, and 320's and 500's existing flaws are untouched. Append to limits:

- **36:** "p88: the ink rim ring is a 0.004 inlay standing on the face (a flat overlay z-fought)."
- **170:** "p88: the fork bridge spans only between the fork plates (rebaked; it ran through them with coplanar faces)."
- **190:** "p88: the screw core stops inside the handle hub, and the buried nut no longer shares the arm's bore (coincident faces)."
- **199:** "p88: the side plates, spokes and guide-roller drums are bored clear inside their hubs instead of sharing the hub bores."
- **220:** "p88: the output shaft ends inside its hub (its end was flush with the hub face)."
- **300, 301:** "p88: the impulse flanges' end walls stand 0.002 inside the band's, and the band is sunk 0.005 under them (coplanar and near-coplanar faces flickered)."
- **311:** "p88: the fly crossarm ends on the vanes' inner edges (its faces lay in the vanes')."
- **320:** "p88: the ratchet is bored to its hub, which runs through it 0.01 proud (a shared bore wall flickered)."
- **326:** "p88: the dark planed strips sit 0.003 off the slot wall and stand 0.003 proud of the frame (they were flush)."
- **327:** "p88: the guide columns stand 0.003 behind the straps' working edges; the gland starts on the cap."
- **373:** "p88: the heaped test load stands 0.003 above the bed, like the fixed stones (its base lay in the bed's top face)."
- **383:** "p88: the roll bodies and brush tips stand 0.002 under the web, which lay in them."
- **402:** "p88: the hubs, pinions, sector bodies and bridge arbors no longer share bores or faces."
- **413:** "p88: the rendered rigid V flanks stand 0.005 inside the unloaded rubber cone and stop 0.003 short of its end planes; the collar buried in nut B is not drawn."
- **447:** "p88: the deck stands on the hull, the stock bearing hangs below the band, and the water ends stand inside the banks (coincident faces)."
- **471:** "p88: crank pin A ends 0.01 inside the arm (it was flush)."
- **486:** "p88: the square boss and the lower bearing seat on the hub and supports instead of sharing their bores."
- **500:** "p88: section parts of one material overlap by 0.5 px, and the disk rim, glass and dial sit in 0.1 px pockets. Touching double-sided faces flickered."
