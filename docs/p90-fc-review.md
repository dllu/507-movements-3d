# Pass 90, lane p90-fc: fixes from the 171–255 audit

Reviewer: Claude Opus 5.5, lane p90-fc (lead plus sub-lanes A: 171–190, B: gears 191–226, C: 225/235). Date: 2026-09-27. Audit: docs/p90-audit-171-255.md. Captures are outside Git, in /dev/shm/p90/fc/. Validation ran both in the live tree and in a mirror (git HEAD, plus this lane's files, plus the one-line 233 builder integration) at /dev/shm/p90/fc/wt. No git writes.

## 233 (high): roller stop rides the trundles

- **Verified.** At HEAD the roller arm swings up about 15° for phase 0.52–0.94 and hovers clear of the wheel, with nothing lifting it (`/dev/shm/p90/c/233/seq.png`). The latch does the same during 0.08–0.52 (`ph1.png`), which the audit did not list. Both "withdrawals" were prescribed so the two alternative stops could be shown one at a time.
- **Change** (`src/simulation/lantern-stop-233-working-parts.js` only):
  - Both stops now stay engaged. The wheel turns counterclockwise one trundle per stroke, twice per cycle (0.16–0.40 and 0.58–0.82), using the latch's own overshoot-and-return law. Counterclockwise is the direction in which both stops yield; clockwise, the latch locks.
  - The roller is a least-lift contact follower. Its arm angle is the smallest outward lift that clears every trundle circle, solved from the circle–circle intervals, so it climbs over the trundle beneath it and drops into the next space. It lifts at most 4.78°, it always touches a trundle, and its largest step between 1/2000-cycle samples is 0.036°.
  - The free roller's spin comes from rolling without slip on the bearing trundle. It is tabulated over one pitch (4096 samples) and is continuous across cycles.
  - The latch keeps its solved clearance lift (up to about 10°) in both strokes, so neither stop moves unless a trundle pushes it.
  - The arm is now Brown's broad tapered flat plate: one extrusion bounded by pivot and roller-boss eye arcs (r 0.14 and 0.22) and their common tangents, with both bores.
- **Integration needed (deferred to the integrator).** `authored-intermittent-core.js` is owned by p90-fa. Until the following one-line change lands, the live `model.update` still runs the old law while `userData.stateAtTime` reports the new one, and the 233 tests fail in the live tree. The helper returns the driven update. At lines 16904–16905 of the builder, replace
  `installLanternStop233(root, latchShape, update); return finish(root, update, …)`
  with
  `const drivenUpdate = installLanternStop233(root, latchShape, update); return finish(root, drivenUpdate, …)`.
  All validation below ran in a mirror (git HEAD, plus this lane's files, plus that one line): `/dev/shm/p90/fc/sync-mirror.sh`.
- **Captures:** `/dev/shm/p90/fc/233/tile.png`, and `233/seqB.png` (20 frames over the first stroke, zoomed on the roller).
- **Tests:** `movement-233` (8, rewritten for the riding law) and `lantern-stop-233-contact` (5) pass in the mirror.
  - New or changed assertions:
    - the roller clears every trundle and always touches one;
    - the lift is continuous and at most 4.9°;
    - both stops are seated at every dwell;
    - two pitches per cycle, with continuous roller spin;
    - each stroke carries the next trundle under both stops.
  - Rendered surfaces still clear the trundles (minimum 2.5e-6).
- **Screens:**
  - Intersections: worst 0.
  - Coincident faces: the same two latent wheel-plate/hub pairs as HEAD.
  - Disconnected parts: 1 transient near-miss (0.019) as the latch falls off a trundle.
  - Loop seams: 0.
- **Proposed ledger row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (replace): "Both stops stay on the wheel, which is turned counterclockwise one trundle per stroke, twice per cycle. The roller is a least-lift contact follower: it rides over each trundle and drops into the next space, rolling without slip. The latch (Brown's flat bar with a 62° slanted end) is lifted by the trundle under it and falls back onto the slant; clockwise it locks after Brown's ~6.7° lash. Bias, holding force and impact are not solved."

## 250: upper wheel is a web disk

- **Verified** against the plate: the upper wheel shows no spokes. It is a thin double rim, an inner circle, and a large boss round the axle.
- **Change** (`bearing-working-parts.js`, which is 250-only):
  - The rim and the four curved spokes are replaced by one lathe section: a thin rim (0.36 radial, full 0.4 depth), a thin web, and a raised centre plate out to r 2.6 (Brown's inner circle). Face and rim edges are creased so flat faces shade flat.
  - The hub is a bored boss (r 1.05).
  - The disk carries the shared quadrant speed cue, because it is now featureless.
- **Captures:** `/dev/shm/p90/fc/250/tile.png`.
- **Tests:**
  - `movement-250` (8) passes; it now asserts 0 spokes and the thin rim.
  - `bearing-working-solids` (5) passes.
- **Screens:**
  - Intersections: 0.
  - Coincident faces: 0.
  - Disconnected parts: the 4 spoke/journal near-misses are gone.
- **Proposed row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "The upper wheel is Brown's plain web disk with a thin rim and large boss; its lower half, hidden in the plate, is assumed to match."

## 219: four-arm cross web

- **Verified.** The plate draws two bars crossing at the off-centre boss. The model had one straight bar.
- **Change** (`authored-eccentric-crown-gears.js`, in the 219 builder only): the web is one flat extrusion of two 0.6-wide bars crossing at right angles at the arbor boss. The arms run into the rim, and the boss (r 0.62, bore 0.345) is concentric with the arbor. The teeth and rim are unchanged.
- **Captures:** `/dev/shm/p90/fc/219/tile.png`.
- **Tests:**
  - `movement-219` (6) passes; the web assertions were updated.
  - `variable-face-gear-solids` (4) passes.
  - `docs/validation/219-224-414-contact.json` was regenerated with 17 poses per movement and 0 penetration. Only the source hash changed.
- **Screens:**
  - Intersections: 0.
  - Coincident faces: 0.
  - Disconnected parts: 59 tooth near-misses (57 at HEAD). These are the existing tooth-to-band pairs.
- **Proposed row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "The web is Brown's four-arm cross meeting at the off-centre boss."

## 234: open cup and hanging flags

- **Verified.** The plate draws an open cup with a thin toothed wall, and flat flags hanging from S. The model had a flush solid disk and flags leaning about 50° from vertical.
- **Change** (`authored-escapements.js`, in the 234 options and `hideGroundFor234`; 238, 299, 300, 301 and 302 are byte-identical by geometry hash):
  - **Cup:** the floor now closes the cup at the bottom of the band. The hub and arbor stop 0.02 inside the floor, under a dark bore disk, so nothing stands up inside the cup.
  - **Verge:** the included angle is 70° (was 100°), with the same 13° half swing, so the flags hang ±35° from vertical. The design equation re-solves S to 0.59 above the tips, with flags 0.88 long and 0.9 wide.
  - **Free-drop margins** (all still positive): release shortfall 0.040 (was more than 0.04), mid-drop 0.020, overrun 0.037 and 0.075.
- **Captures:** `/dev/shm/p90/fc/234/tile.png`.
- **Tests:**
  - `movement-234` (8) passes.
  - Updated thresholds: the included angle; drop margins ≥ 0.035, 0.018, 0.035 and 0.07; plane separation 5e-15 (was 2.5e-15).
  - `verge-crown-working-solids` (5) passes.
- **Screens:**
  - Intersections: 0.
  - Coincident faces: the 13 latent low-contrast (0.04) tooth/band pairs from HEAD remain.
  - Disconnected parts: as HEAD.
- **Residual:** Brown's flags look vertical; a working verge needs a lean, so 35° is the compromise.
- **Proposed row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (replace the cup and flag text): "An open cup crown: a thin toothed wall on a floor at the band's foot. The verge's flags are 70° apart and hang ±35° from vertical, so the drops keep positive clearance; Brown draws them nearly vertical."

## 242: one flat strap joint

- **Verified.** The lever sat at z 0.30–0.44 and the anchor link at 0.54–0.64, in front of the strap (−0.01–0.17). The pins ran from −0.46 to 0.78.
- **Change** (`correctCraneBrakeJoints`, 242-only):
  - The lever lies against the strap's front face (0.178–0.318) and the anchor link against its back (−0.118 to −0.018).
  - The lever's fulcrum eye is a boss reaching back to the link.
  - Every pin now ends 0.03 proud of the stack it joins. The whole joint is 0.44 deep.
- **Captures:** `/dev/shm/p90/fc/242/tile.png` and `242/zjA.png` (compare the audit's `zj.png`).
- **Tests:**
  - `movement-242` passes.
  - `band-drive-working-parts` (8) passes, including a new flat-joint test.
- **Screens:** intersections 0; coincident faces 0; disconnected parts as HEAD.
- **Proposed row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "Strap eyes, anchor link and lever are stacked flat about the strap plane; the fulcrum eye is a boss."

## 244: wooden block, straight bolts, no stop standard

- **Verified.** The upper wooden block did exist, but as a thin yellow crescent that read as part of the strap ring. The bolts kinked through ball-jointed links. An undrawn post with a foot carried C and C′.
- **Change** (`correctProny` in `clamp-working-parts.js`, 244-only; the brake is stationary):
  - **Block:** Brown's hatched block is now one wood-coloured extrusion. It has a flat top under lever D, straight sides clear of the bolts, and a bottom that is the pulley arc. It sits on the strap's top ends and reaches back to just behind the lever. Its working-arc angles are updated.
  - **Bolts:** each strap end has a straight vertical eye bolt. An eye round the strap-end pin (extended through it) leads to a shank through the lever and the nut on top. The ball-jointed links and the shoe hangers are hidden.
  - **Stops:** the stop post, bridges, lower standard and foot are hidden. C and C′ remain as drawn, as fixed stops.
- **Captures:** `/dev/shm/p90/fc/244/tile.png` and `244/zbA.png`.
- **Tests:**
  - `movement-244` passes.
  - `clamp-working-solids` (5) passes, including a new block/bolt/no-standard test.
- **Screens:**
  - Intersections: 0.
  - Coincident faces: 0.
  - Disconnected parts: C and C′ are now "floating" (they are fixed stops, drawn floating). Near-misses are as HEAD.
- **Proposed row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "C and C′ are fixed stops without a drawn standard; the jointed strap and bolts are stationary."

## 212: Brown's opening pose

- **Verified.** At t = 0 the model showed the start of the run, so the convex face a–b sat at the left. Brown's pose, with a–b beside the top slot and A's finger at a slot mouth, is the moment two indexes are done.
- **Change** (`geneva-212-contact.js`, 212-only): display time starts at the third index (demonstration time 7.8 s) through `userData.displayTimeOffset`. The states keep the demonstration clock. The loop is unchanged: it is the same cycle.
- **Captures:** `/dev/shm/p90/fc/212/cmp3.png` (new t = 0 beside the old ph 0.667 frame) and `212/n00.png`.
- **Tests:**
  - `movement-212` passes; the rendering checks now apply the offset.
  - `geneva-212-contact` (6) passes, including a new check that it opens with B two steps on and a–b in the upper right.
  - `geneva-stop-working-solids` passes.
- **Screens:** intersections 0; loop seams 0; coincident faces: the existing latent A/B face pair.
- **Proposed row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "The display opens two indexes into the run (Brown's pose)."

## 240: flat stop plates

- **Verified in part.** The hook and straight stops were already flat plates, but narrow (0.30–0.36 wide), with small eyes and 0.41-wide black collars that read as big pins.
- **Change** (`ratchet-stop-240-working-parts.js`):
  - **Hook stop:** 0.48 wide at the pivot, tapering to the toe. Its bow is widened outward only, so the inner edge still clears the tips.
  - **Straight stop:** 0.48 wide at the pivot.
  - **Eyes and collars:** r 0.25 eyes concentric with the pivots; collars reduced to r 0.13, just proud of the plate.
  - **Paths:** the regenerated `baked/ratchet-stop-240-paths.js` is byte-identical, so the wider plates do not constrain any lift.
- **Captures:** `/dev/shm/p90/fc/240/tile.png`.
- **Tests:** `movement-240` and `ratchet-stop-240-working-parts` pass (13 in total).
- **Screens:** intersections 0; coincident faces 0; disconnected parts as HEAD (the 2 fixed pivots have no drawn frame).
- **Residual:** the straight stop still turns down into its toe; Brown draws a straighter wedge nose. That bend is where the toe leaves its space so the bar clears the next tip.
- **Proposed row:**
  - assessment: minor
  - visibleFlaws: "The straight stop turns down more sharply into its toe than Brown's wedge nose."
  - limits (append): "Hook and straight stops are broad flat plates with eyes concentric with their pins."

## Lows

- **218:** the white stud A (the follower in the groove) now takes the rocker's colour. White is reserved for markers. `movement-217` and `movement-218` pass, and so does `wool-comber-contact`. Proposed limits: none.
- **253:** the hook bars are wider (bar radius 0.14 → 0.21, so 0.42 wide) and the bored eyes larger (r 0.36 → 0.43). The stud contact law uses the new width, so contact stays exact (gap tolerance 1e-15). `movement-253` passes; intersections 0. Proposed limits: none.
- **251 (disputed):** the pile and anvil are what the weight W strikes. Without them W would fall onto nothing, so they stay.
- **236:**
  - **Disputed in part.** The "dark band" is the lever's cast shadow on the pawls, which lie behind it. A no-shadow render makes the pawls uniform (`/dev/shm/p90/fc/236/shcmp.png`).
  - **Deferred.** The needle taper is fixed by the builder's `pawlFlankPolylines` and `pawlNoseRadius`, which the idle pawl's riding solve also uses, in the p90-fa-owned builder.

## Deferred

- **233:** the one-line builder integration above.
- **206 (medium):** the left pawl's heel and notch are built entirely in `authored-intermittent-core.js` (owned by p90-fa), with no helper.
- **236 (medium):** the pawl width and nose are builder constants (p90-fa).

## Sub-lane p90-fc/A: movements 171–190

Reviewer: Claude Opus 5.5, sub-lane p90-fc/A. Date: 2026-09-27.

- **Before captures:** the audit's captures in `/dev/shm/p90/c/NNN/`.
- **After captures:** `/dev/shm/p90/fc/NNN/`. `tile.png` holds the plate, def, ph 0.33, ph 0.66, yaw ±50 and back views; `zall.png` holds the zooms.
- **Claimed files:** `authored-marine-valve-gears.js`, `authored-curve-generators.js`, `authored-locomotive-valve-gears.js`, `gab-disengager-186.js` and `gab-disengager-189.js`. These were also claimed but left unedited: `authored-engine-couplings.js`, `authored-gab-disengagers.js`, `authored-silk-traverses.js`, `authored-clamps.js`, `authored-variable-cranks.js`, `authored-engine-reversers.js` and `authored-diagonal-catches.js`.
- **Test registry:** `registry.js` was broken mid-edit by other lanes all session (`reed-396-contact.js`, `authored-mutilated-racks.js`, `guernsey-anchor.js`). Registry-based tests therefore ran through a temporary synchronous shim (`tests/.p90fc-registry.mjs` plus `.p90fc-*.test.mjs` copies, deleted afterwards). The shim uses the same factories plus `applyDisplayTiming`.

### 171 (medium): fixed
- **Plate check.** The finding holds. Each rod eye carried a loose blue torus washer standing proud of the link. The link's lugs (r 0.13) hid behind the washers, and the link's right end was a radial flat cut. Brown draws round link ends, with the rod eyes pinned on lugs.
- **Change** (`authored-marine-valve-gears.js`):
  - The link plate now has round ends (r 0.17 arcs at both arc ends).
  - The slot ends are round (r 0.06).
  - The rod-pin lugs are r 0.19, concentric with the pins.
  - The strap's integral rod eye is r 0.19, up from 0.13.
  - The torus washers are removed.
  - Each pin runs from the link's far face through the rod eye and stands 0.02 proud of it (length 0.47; was 0.58).
  - Low finding fixed too: the strap's stick-like bolt lugs are now round-ended ears 0.20 wide in the strap plane.
- **Captures:** `171/tile.png`, `171/zall.png` (link at ph 0 and 0.5, oblique, strap ears).
- **Tests:**
  - New `tests/movement-171.test.mjs`: pins only, and link material all round each pin at 4 phases. Passes.
  - `scripts/review-marine-valve-{upper,eccentric}-solids.mjs` now pick the pin with `children.at(-1)`, because the torus was child 0.
- **Reports regenerated:** all nine `docs/validation/171-*.json` reports, except `171-browser.json`, came from their review scripts. There are 0 intersections in every one, with pose counts unchanged. Mesh counts went from 37 to 35 in `171-all-clearance` and `171-cycle`.
- **Screens:**
  - Disconnected parts: unchanged from the audit. The one floating item is the undrawn trunnion stub or bearing face (p60 policy), and there is one short-of-pin (the die pin, a bore clearance).
  - Coincident faces: 0. Seams: 0.
- **Proposed ledger row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "Pass 90: link ends round and rod pins through concentric lugs and the rods' integral eyes; loose washer tori removed; strap bolt ears are round-ended tabs."

### 172 (medium): fixed; the framing half declined
- **Plate check.** Brown's right end is a large eye, the size of the crank bosses (r about 0.29). Its flat-topped end runs on to the right and is broken off: the end of a crosshead. The model showed a small rod eye (r 0.22) sliding alone on the guide line.
- **Change** (`authored-curve-generators.js`):
  - A new `crossheadEye` plate replaces the undrawn square slider block. It is an r 0.30 eye concentric with the wrist pin, integral with a bar 0.60 wide running straight on along `guideY`, and it ends square 0.6 past the pin, just beyond Brown's break.
  - It is gold (accent), so it reads as a separate part from the blue rod.
  - The guide frame, back bar, posts and flanges were always removed by the source presentation. They are no longer built, which also removes a latent eye/frame overlap.
- **Framing, declined.** The fit is the display profile's motion box (x −1.55…6.85), which already covers the full crank circle and crosshead stroke. In the square capture the mechanism spans 13–80 % of the width. The empty right part is the crosshead's stroke, and the vertical emptiness comes from the 8.4:2.9 aspect. A tighter crop would clip the motion.
  - The `source-presentation.js` 172 entry still names the removed parts. That is harmless: the patterns now match nothing. The note could say "crosshead eye and bar shown"; the file is owned by p90-fe.
- **Captures:** `172/tile.png`.
- **Tests:** `movement-172` now has 4 tests; the new one checks the eye radius, the eye on `guideY` at the wrist, and that no frame parts exist. All pass.
- **Reports:** `docs/validation/172-clearance.json` was regenerated: 129 poses, 7 meshes, 0 intersections.
- **Screens:** all clear.
- **Needs:** a packaged e2e rerun for `172-browser.json`, which fingerprints the file. On the vite dev server the spec's restart pixel-equality fails for 172, and also for the unchanged 176, so the failure comes from the environment. No packaged dist was built, because the build is shared with the other lanes.
- **Proposed ledger row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "Pass 90: the wrist is Brown's large eye on a crosshead bar that runs on 0.6 past the pin and slides along the guide line; the reconstructed slider block and frame are no longer built."

### 176 / 177 (medium): no change, finding disputed
- **Framing.** In both movements a crank turns a full circle about the lower shaft: the output crank in 176, the input crank in 177. The camera fits that whole orbit, so the crank reaches within about 10 % of the frame edges at ph 0.33 and 0.66 (audit `176/ph1.png` and `177/ph1.png`). At t = 0 the crank points up, which leaves the lower half empty. Reframing to the t = 0 pose would crop the crank for most of the cycle.
- **176 window.** The caption says the wrist "passes through the slot" of the ring. The white inside Brown's slot is the open slot around the sectioned wrist, not a solid band. The see-through window shows the real open passage, so closing it would block the wrist's path in 177's released state.
- **Proposed ledger:** unchanged. If the rows are to answer the audit, add "(p90: default framing covers the full crank orbit by design; the ring window is the open passage the wrist travels in)" to limits.

### 185 (medium): fixed; the framing half declined
- **Plate check.** Brown's masonry block is one massive block from raster (60, 86) to (187, 220). The hatching along its top and right edges is shading, but the model had two thin pale bands, an L-frame open inside. Brown's eccentric rods flare into flat straps with two square bolt ears, where the model had thin torus rings and an even-width rod. There were also loose torus washers on the rod eyes.
- **Change** (`authored-locomotive-valve-gears.js`):
  - The wall is one solid box (x −4.48…−1.81, y −0.81…2.0, z −1…−0.5). The two wall supports are embedded 0.05 into it, so no coplanar contact remains.
  - The straps are flat ring plates (bore r 0.686, outer 0.837) with two square ears across the rod line. Each strap now turns with its rod, as one rigid strap.
  - Each rod flares with a Bézier from ±0.20 at the strap to ±0.09, then tapers to ±0.058 at its eye.
  - The link-pin tori are removed. The pins run from the link's far face through the rod eye (length 0.43; was 0.72).
- **Framing, declined.** The swept fit already spans about 83 % of the default width (`185/def.png`), matching the plate's wide, short proportion.
- **Captures:** `185/tile.png`, `185/zall.png` (eccentrics, link, oblique, wall).
- **Tests:**
  - `movement-185` now has 4 tests; the new one checks the single wall block, the extruded straps turning with their rods, and pins only. All pass.
  - `valve-family-solids` 185 passes: the rods still start outside the sheaves.
- **Screens:** mesh count 50 → 47, near-miss pairs 18 → 14. The 6 short-of-pin leads are unchanged in kind: rod/sheave bore clearance, the rod-eye face gap to the link end, and the die pin in its slot. Coincident faces 0. Seams 0. No validation report fingerprints this file.
- **Residual (pre-existing, not in the finding):** the steam chest sits over the block's top-right corner, where Brown draws it just right of the block.
- **Proposed ledger row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "Pass 90: the sectioned wall is one solid block; eccentric straps are flat eared rings turning with their flared, tapered rods; rod eyes pinned without washer tori."

### 186 (medium): fixed, with the audit's fix corrected
- **Plate check.**
  - The audit's suggested fix (loop and claw as one part) is wrong. The spring handle is riveted to the rod and catches in notch a on the lever's drop, so it cannot be part of the lever.
  - The real flaw was the loop's shape. Brown's loop is a narrow U. The diagonal bar runs straight down to a round bottom, the return leg rises straight on the inner (left) side, and its top turns right into the tongue. The tongue passes behind the bar (Brown breaks the tongue's lines at the crossing) to bear on the drop under a.
  - The model had put the return leg on the outer side, with an S-kink, and twisted it through a 0.49 depth step.
- **Change** (`gab-disengager-186.js`):
  - The strap's rest centreline is re-traced from a gridded plate crop: a straight bar, a round bottom, a straight inner leg, and a tongue flat under the drop.
  - The depth step now lies along the straight inner leg only. The bar stays in the rod's plane, and the leg top and tongue lie in the lever's plane behind the bar.
  - The rocker and lever are thinner and closer: rocker [−0.2, −0.06], lever [−0.36, −0.22]. That halves the step to 0.27.
  - The valve pin and pin c are trimmed to z −0.38 (they stood 0.26 proud behind).
  - `BAR_PX` 150 → 200, so the bent bar ends on the loop with the tongue sliding 0…3.7 px along the flat (the old design's latched slide was 3.4 px). With shorter bend lengths the solution slid backwards into the ramp, and the strap entered the lever.
- **Captures:** `186/tile.png`, `186/zall.png` (default, yaw 50, top, latched).
- **Tests:**
  - `movement-186` now has 7 tests; the new one checks the loop bottom at y 489, the bar and inner leg both crossing y 400, the bar in the rod's plane, the tongue in the lever's plane, and a step under 0.3. All pass, including strap-never-enters-lever, tip touch and loop rigidity.
- **Reports:** `docs/validation/186-187-cam-solids.json` was regenerated: 0 intersections for 186–189. The HEAD report's mesh counts (13/8/11/16) were already stale against the current code; the regenerated counts are 26/22/28/29.
- **Screens:** unchanged: 0 detached, 2 near-miss bore clearances. Coincident faces 0. Seams 0.
- **Residual:** from oblique views the inner leg visibly steps back 0.27 in depth. That step is forced by Brown's self-crossing loop.
- **Proposed ledger row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "Pass 90: loop re-traced as Brown's narrow U (straight bar, round bottom, straight inner return leg, tongue passing behind the bar to notch a); the forced depth step (0.27) lies along the straight inner leg; rocker and lever thinned so the step is half as deep."

### 189 (low): fixed
- **Change** (`gab-disengager-189.js`): the see-through fork slot is now a 0.03-deep recess in the rod's front face, drawn by Brown as lines on the face. The rod body runs z −0.10…0.07, and a front-face plate runs 0.07…0.10 with the slot cut out; both carry the pin bores.
- **Captures:** `189/zall.png`.
- **Tests:** `movement-189` passes 5/5 (the flush-pin check now uses the face plate, and a new assertion checks the rod body backs the recess).
- **Reports:** the cam-solids report was regenerated with 0 intersections.
- **Screens:** coincident faces 0. The one new near-miss is between the face plate and the hanger link, an artefact of the split into two meshes.
- **Proposed limits (append):** "Pass 90: the fork is a shallow face recess, not a through slot."

### Lows not done
- **173:** dropping the joining upright would leave two floating fixed blocks. The trade-off is a judgment call, not clearly right.
- **174, 180, 190** (`authored-clamps.js`): the file is fingerprinted by the 180 MuJoCo bake (`180-bake.json`). A low-severity visual change would force a native re-bake.
- **178** (`authored-variable-cranks.js`, shared with 168): the rod's end eye belongs to the reconstructed tool slide, and the change would cascade into 168/178 reports and a browser report.
- **179** (`authored-engine-reversers.js`): fingerprinted by the 179 native-stop MuJoCo study.
- **181, 182** (`authored-diagonal-catches.js`): fingerprinted by the 181 MuJoCo bake.

### Deferred or outstanding
- **Browser reports:** `171-browser.json` and `172-browser.json` fingerprint changed files and need a packaged e2e rerun. The marine spec passed on the dev server; the 172 spec's restart equality fails on the dev server, as it does for the unchanged 176.
- **Body-intersection screen:** see the note appended below.
- **Source presentation:** `source-presentation.js` (p90-fe) still lists 172's removed slider and frame patterns, which now match nothing.

### Body-intersection screen (run through the shim)
- **Results:** 171, 172, 186 and 189 are all 0. 185's worst is 0.0943, between `moving-upper-suspension-rod-pin` and the `finite-link-lifting-suspension-rod` box. That value and pair match the ledger's Pass-49 entry exactly, so it predates this pass and the change is not the cause.
- **Final test run:** the registry-based tests for 185, 186 and 189 passed 16/16 through the shim just before it was deleted. Direct-import tests 171, 172 and valve-family-solids also pass.
- **Rerun needed:** once `registry.js` loads again (other lanes' `reed-396-contact.js` and others), rerun `movement-185`, `movement-186`, `movement-189` and `screen-body-intersections` normally.

## Sub-lane p90-fc/B: gear family (191–226)

The main builder `authored-gears-core.js` is owned by p90-fa, so all work went through the post-processing helpers. Captures are in `/dev/shm/p90/fc/B/cap/` (after tiles `NNN-after-tile.png`); the before captures are the audit's `/dev/shm/p90/c/NNN/`. The tests and screens below ran in the live repo, where `registry.js` loaded again by the end.

### 192, 193 and 194 (low): pinion teeth and wheel bore (`reversing-mangle-guides.js`)
- **Checked against the plate.** The "petal" teeth came from the factory's one-segment chamfer (bevel inset 0.035) round the pinion outline, which shaded each tooth as a faceted petal. The outline itself is already involute. 193's pinion has 10 teeth, where the audit said 12; the plate shows about 10.
- **Pinion change.**
  - The pinion is now the same outline extruded flat, over the same 0.37 depth, with no bevel.
  - The outline is unchanged, so the baked conjugate wheel cavities still match and need no regeneration.
  - I kept involute teeth rather than Brown's square convention, following the "involute pinions" rule.
- **Bore change (the 193/194 crescent).**
  - The wheel backing bore was 0.111 round a 0.075 shaft, which left a lit crescent visible from behind.
  - It is now 0.079 (0.004 clearance), matching the frame's own rear-bearing bore.
- **Captures:** `pin-a.png` (before), `pin-after.png`, `193-after-tile.png`, `192-after-tile.png`, `194-after-tile.png`.
- **Tests.** `reversing-mangle-finite-guides` passes 12/12, including a new test for the flat pinion and the bore fit. `movement-192`, `-193` and `-194` and `mangle-contact` also pass.
- **Screens.** Intersections 0, coincident faces 0, seams 0, no detached parts. Near-misses are 111/104/125, down from 115/107/127.
- **Not done:** the UJ cross still covers the pinion hub in 192/194 (low). It lives in `mangle-universal-drive.js`.
- **Proposed ledger rows.**
  - 192: minor; visibleFlaws "universal-joint shaft crosses the pinion's face in the default view"; append to limits "Pinion is the factory involute outline extruded flat (no chamfer)."
  - 193: reasonable; visibleFlaws empty; append the same limit.
  - 194: minor, keeping its existing UJ note; the crescent is fixed.

### 196: strap arm and stand pivot (`irregular-gear-family.js`)
- **Checked against the plate.** The arm was a uniform 0.12 black link, and the stand pivot was a 0.25-radius, 0.8-long barrel.
- **Arm.** It is now one flat strap: an eye at the stand (r 0.25) and an eye at A (r 0.15), joined by their common tangents and bored at both eyes. This matches Brown's widening strap.
- **Stand pivot.**
  - The barrel is now a bored eye (r 0.23) in the pedestal's own plane, 0.01 proud of the pedestal on each face to avoid coplanar faces.
  - It carries a plain pin (r 0.073) running to just proud of the strap's front.
- **Captures:** `196-after-tile.png`, against the audit's `196/tile.png`.
- **Tests.** `irregular-gear-family` passes 7/7, including a new strap/pin test, and `movement-196` passes.
- **Report.** `docs/validation/191-196-201-contact.json` was regenerated in the live repo: 513 poses each, 0 penetrating. 191 and 201 are byte-identical (hash check `hash.mjs`: 191 `06d5701d`, 201 `49eb8ffc`, unchanged).
- **Screens.**
  - Coincident faces: only the pre-existing latent pinion hub pair remains. The stand eye/pedestal pair I introduced has been fixed.
  - Intersections 0, seams 0.
  - The detached component is the existing pinion-B stay and flange group.
- **Residual.** The builder adds the pedestal about 0.9 behind the arm plane, after the helper runs. The pin therefore still spans that depth; this shows only in rotated views.
- **Proposed ledger row:** minor; visibleFlaws "stand pin spans ~0.9 from the pedestal to the strap in rotated views (pedestal placed by the builder)".

### 197: back of the plate (`mangle-rack-working-parts.js`)
- **Checked against the plate: partly disputed.**
  - Brown's rectangle is a solid plate. Seen from behind it hides the face-mounted rack, as a real plate would, so double-sided translucency would be wrong. I kept it opaque.
  - The real flaw was the undrawn back slide rail and channel block. Both are now hidden, kept as data only.
- **Lows.**
  - The guide mounts end inside the frame (outer edge 4.61 against the frame's 4.79). They only appear to poke out through perspective in the def view.
  - I did not change the pin contrast.
- **Captures:** `197-after-tile.png`; the back now shows a plain plate.
- **Tests.** `mangle-rack-working-contact` passes 10/10, including a new test that the rail and channel are hidden. `movement-197` and `-198` pass.
- **Screens.** Coincident-face pairs are unchanged and all already in the latent list. Near-misses are 24, down from 31.
- **Proposed ledger row:** reasonable; visibleFlaws empty; append to limits "The reconstructed back slide and channel are not rendered (Brown draws none)."

### 226: frame A (`bevel-200-226-corrections.js`)
- **Checked against the plate.**
  - The two-hole crank lever already exists: it is the vertical lever with two holes on the E sleeve, seen edge-on (`226-crank-a.png`). The audit's "disc" claim is wrong.
  - The flat frame existed, but was a 0.22 band only 0.08 thick, and the arm from the collar on F was a 0.05 wire.
- **Change.**
  - Frame A is now a 0.26 band, 0.14 thick.
  - The arm from the collar and the tie to the frame take the band's width. The tie sits 0.01 inside the frame faces, and the arm sits inside a collar enlarged to r 0.16, so neither creates coplanar faces or lips.
  - I first widened the planet journal's cantilever and strap too, but reverted that because it produced lip flags.
- **Captures:** `226-a.png` (before), `226-c.png`, `226-after-tile.png`.
- **Tests.** `bevel-200-226-solids` passes 5/5, including a new band test, and `movement-226` passes.
- **Report.** `docs/validation/200-226-bevel-solids.json` was regenerated in the live repo: 33 poses, 0 penetrations. 200 is untouched.
- **Screens.** Coincident faces 0, lips 0, intersections 0, seams 0.
- **Not done:** D's teeth projecting past its face (low).
- **Proposed ledger row:** reasonable; visibleFlaws empty; append to limits "Frame A and its F arm are one 0.26 flat band; the left crank is Brown's two-hole lever (seen edge-on from the front)."

### Deferred
- **191** (deferred: file owned by p90-fa).
  - The spike is the scroll's step wall. The builder's pitch spiral runs from radius 1.26 to 2.0, so the step is about 0.75 deep, where Brown's is about one tooth. A proper fix changes the pitch curves in `authored-gears-core.js` and re-hobs through `scripts/generate-irregular-gear-profiles.py`.
  - I dispute square teeth: the rack-hobbed conjugate teeth are the intended ideal form.
- **205** (deferred: file owned by p90-fa). The L-shaped front teeth come from the face bars and root keys that the builder adds after `correctVariableDrive` (`authored-gears-core.js` around lines 32688–32744). A helper cannot reach them.
- **Lows:**
  - 198's proud pins: not changed; the long stubs are pins running back to side posts that source-presentation hides.
  - 201's braided belt: the belt is built in the owned builder.
  - The 192/194 UJ: it lives in `mangle-universal-drive.js`, which is shared with 193.

### Integrator notes
Both regenerated reports fingerprint `authored-gears-core.js` at p90-fa's current working copy. If p90-fa edits that file again, rerun:
- `node scripts/review-irregular-gear-contact.mjs && python3 scripts/review-irregular-gear-contact.py`
- `node scripts/review-200-226-bevel-solids.mjs`

## Sub-lane p90-fc/C: 225, 235

Validation was run in a mirror at `/dev/shm/p90/fc/C/wt`. The mirror is git HEAD plus the files claimed by p90-fc, the 233 builder patch, and my tests. It was needed because the live `registry.js` is broken by other lanes' in-progress edits. Captures come from the live dev server on :45961.

### 225: the carrier pawl's hook curl

**Verified against the plate.** Brown's pawl is a plain curved bar with a straight end butting the tooth face. The model's bar ended in a cubic hook (`hook = 0.6`) turned down along the tooth-space bisector, so it read as a curl into the space.

- Before: `/dev/shm/p90/fc/C/225/tile-before.png`, `zt-before.png`.

**Change** (`src/simulation/carrier-pawl-225-working-parts.js`, `installCarrierPawl225` only):
- **Centre line.** One circular arc (a cubic approximation, within 0.002), bowed away from the wheel, with no hook.
- **End.** A straight cut lying along the driven tooth's steep face at mid-drive. It is turned back 9° (`PAWL_END_RELIEF_225`) so the pawl's turn through the drive never brings it into the face. The working nose radius (0.06) remains only as the wheel-side corner.
- **Taper.** The outer edge ends at a 0.1 half-width, which gives the cut a real face of 0.08. The wheel-side edge stays slim.
- **Unchanged.** Builder kinematics, nose contact law, `carrierPawlFlank225`, `carrierPawlClearance225` and `carrierPawlBarLiftLimit225`. The return ride automatically uses the new wheel edge through `g.pawlWheelEdge`.

**Forced residual.** The sagitta had to rise from 0.17 to 0.50 (19% of the 2.64 length). The model's tooth behind the nose stands on the pivot–nose chord, so without the hook the bar has to arch over it.
- Sagitta 0.40 still cuts that tooth by 0.015.
- Sagitta 0.45 clears it, but it breaks return continuity at phase 0.5 (a pose jump of 1.5e-4) and leaves only 0.00276 of the required 0.003 mid-return ride.
- Brown's arch is about 0.2 (about 8%). A lower arch needs a builder change: move the pawl pivot or change the pawl length or swing. That builder is owned by p90-fa.

**After.** `/dev/shm/p90/fc/C/225/tile-a.png` (plate, default, phases, rotated, back) and `zt-after.png` (nose at phases 0, 0.15, 0.33, 0.66).

**Tests.** 12/12 pass in the mirror: `carrier-pawl-225-contact` 6 and `movement-225` 6.
- The worst whole-outline clearance is 0.00020, which is the nose's running gap.
- The mid-return ride clearance is 0.00305.
- The new assertions check that the centre line is one circular arc and that the end is a straight face at least 0.06 long, lying within its relief of the tooth face.

**Screens.**

| Screen | Result |
|---|---|
| Coincident faces | 0 |
| Body intersections | worst 0.0000 |
| Loop seams | 0 |
| Disconnected parts | unchanged from before; the one near-miss is the wheel against the journal, 0.041 |

No validation report fingerprints this helper.

**Proposed ledger row.**
- assessment: minor
- visibleFlaws: "Pawl arch (sagitta 0.50) is about twice Brown's, forced by the model's pivot and tooth geometry."
- Append to limits: "Pawl is one circular-arc bar with a straight end cut along the driven face (9° relief); no hooked nose."

### 235: tappet as a beak blade

**Verified against the plate** (`/dev/shm/p90/fc/C/p235crop.png`). Brown's tappet is a flat blade:
- a pointed beak;
- a straight back running from the beak down to a V notch, then stepping up onto the arm's edge;
- a convex front sweeping from the beak round to the arm's other edge.

The model's crescent read as an even-width curved rod.

**Before:** `/dev/shm/p90/fc/C/235/tile-before.png`.

**Change** (`src/simulation/star-tappet-working-parts.js`): new `tappetBladeOutline` / `TAPPET_BLADE_235`, which builds one extrusion.
- The back runs along the arm's edge.
- The notch has two straight sides, with its apex at (1.76, 0.19) in the tappet's frame.
- The working nose arc is unchanged (angles -2.6 to 1.2, radius 0.0695).
- One cubic front runs from the nose to the arm's edge.
- A round eye (r 0.15) surrounds the hinge bore.

The notch is placed where the star's point actually sweeps during the drive. I mapped that sweep over 60 drive poses (`m235.mjs`, ASCII map). The swept point sits directly behind the nose, so Brown's straight back from the beak cannot run all the way to the tip. His notch is therefore moved up behind the nose to receive the point, and it has 0.02–0.05 clearance.

**After.** `/dev/shm/p90/fc/C/235/tile-b.png` and `yphases.png` (phases 0, 0.12, 0.24, 0.4, 0.6, 0.8).

**Baked paths.** I regenerated `baked/star-tappet-paths.js` with `generate-star-tappet-paths.mjs` in the mirror. The blade does not constrain the solved return path, so the file came out byte-identical, and `--check` passes. It has 1001 samples, as before.

**Tests.** 14/14 pass (`movement-235` 6, `star-tappet-working-parts` 8). The new test checks:
- the blade is one extrusion with a bore;
- the notch is open, with solid blade on both sides;
- the blade is at least 0.4 wide behind the beak and under 0.2 at the beak.

**Screens.** Coincident faces 0, body intersections worst 0.0000, loop seams 0. Disconnected parts match the audit exactly: the star group floats with no drawn frame, and the near-misses are the pre-existing layer gaps.

**Residual.** The nose lobe sits on a short neck, about 0.12 wide, between the notch and the front, so the beak tip reads slightly knobbed rather than sharp. The nose radius is fixed by the builder's contact law.

**Proposed ledger row.**
- assessment: reasonable
- visibleFlaws: ""
- Append to limits: "Tappet is one flat beak blade with a V notch placed where the star's point sweeps behind the nose; the working nose keeps the builder's radius, so the beak tip is slightly rounded."

### Deferred and not done
- **225, full match to Brown's arch.** This needs a builder change to the pawl pivot, length or swing in `authored-intermittent-core.js`, which p90-fa owns.
- **237 and 241 lows** (a round arm with a collar and the inner ledge on 237; a broader click horn on 241). I claimed the helpers, then released them. The click and arm outlines come from the builder's contact geometry (`g.holdingClickOutlinePoints`), so widening them safely is not a quick fix.
- **238** (`authored-escapements.js`, the parent lane's file) and **239** (a gears-core helper, sub-lane B's area): not touched.
- No git writes.
