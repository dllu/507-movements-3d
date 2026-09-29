# Pass 99 lane p99-d: remaining minor rows 277, 309–312, 402, 407

- **Lane:** p99-d (Claude Opus 5.5), 2026-09-28. No git writes; `docs/movement-status.*` untouched.
- **Sub-lanes:** p99-d-A did 309–312 and p99-d-B did 402. Their sections follow mine. 277 and 407 were done by the lane itself.
- **Claims (`/dev/shm/p99/claims`, owner p99-d):**
  - authored-gravity-escapements.js, gravity-escapement-plates.js, source-presentation.js (only the 310–312 notes changed)
  - authored-guernsey-escapements.js, guernsey-anchor.js, guernsey-anchor-402.js
  - authored-colt-ratchets.js, authored-pointed-arch-instruments.js (unedited), drawing-template-parts.js
  - display-profiles.js and display-profiles.json
- **Display profiles:** regenerated with `node scripts/measure-display-profiles.mjs 277 309 310 311 312 402 407`. The script rewrites only the requested IDs, and earlier uncommitted edits to other IDs were preserved.
- **Integrated tests:** 117/117 pass:
  - movement-277, 309–312, 402 and 407
  - gravity-escapement-p96, p99 and working-solids; guernsey-working-solids; drawing-template-working-solids
  - p86-sliver-joints and sliver-joints-p86-7; see-through-part; authored-loader; camera-catalog; display-tooth-passing
- reviewed-cycle-timing passes 15/15. `models.test.mjs` has no blocks for these IDs.
- **Captures:** `/dev/shm/p99/d/{277,407,A,B}/`.

## 277: the hammer now turns on Brown's arbor (flaw removed)

**Verified.** Brown's hatched arbor circle is centred at plate (302, 375) with a radius of 27 px (crop `/dev/shm/p99/d/277crop.png`). The model's pivot was at (301, 394).

**Fix.** `sourceRasterHammerPivot` is now (302, 375). Every part is placed from the plate relative to that point, so the hammer outline, dog pivot, cylinder, spring c and mainspring keep their plate positions, and the hammer now turns about Brown's circle.

**The kinematic consequence, and how it was solved:**
- With the pivot 0.21 higher, the dog pivot (212, 389) sits just below the axis instead of level with it.
- One cock now lifts the dog tip about 0.52 instead of 0.28.
- In the old dog plane (0.17 from the cylinder axis), that lift swept the tip about 109° round the face ratchet. The next tooth then lay under the returning hook, and the dog rested on its back ramp. The rest tip x was −1.954, where the land is at −2.015; the test caught this.
- Fix: the dog plane moves to 0.30 from the axis. The sweep returns to about 79°: 60° to index, plus the run across the land, as before.
- Checked with the planes 0.24, 0.28, 0.30 and 0.34; 0.30 and 0.34 seat cleanly. The hammer stroke stays 42.3°.
- A smaller stroke (30–38°) was tried in the old plane and does not help.
- The parts behind the dog (hammer and tumbler) move forward with it by 0.13. This depth is invisible in Brown's side elevation.

**Result (periodic solve):**
- One exact 60° step per cock; closure errors are 1e-11 for the cylinder, 1e-15 for the dog and 8e-10 for the spring.
- The hook seats at the land plus the clearance.
- The hook rides 0.09 or more over the next tooth on the fall.
- Spring c bears throughout.

**Camera.** The fit box's y limits moved down by the same 0.209, so the default framing matches HEAD (`ba-ph0.5.png`).

**Captures** (`/dev/shm/p99/d/277/`):
- `ba-ph0.png`, `ba-ph0.5.png` and `ba-ph0.75.png` show the plate, before and after.
- `a-rot.png` shows yaw ±40, pitch ±25, side and back.
- The raw shots are in `before/` and `after/`.

**Screens:**
- Disconnected parts: 0 detached, 0 slivers, 0 lips. Near-misses went from 7 to 6, and short-of-pin stays at 1, as at HEAD.
- Coincident faces: 0. Body intersections: 0. Loop seams: 0.

**Tests.** movement-277 passes 9/9. The raster-pivot assertion is now (302, 375).

**Proposed ledger row:**
- assessment: reasonable
- visibleFlaws: none
- limits (append): "p99: the hammer turns on Brown's hatched arbor (302, 375); the dog plane is 0.30 from the cylinder axis (was 0.17) so the larger dog lift still sweeps about 79° round the face ratchet and the hook reseats on the land."

## 407: the knot and thumb wing are replaced by a turned winding peg (flaw removed)

**Verified** (`/dev/shm/p99/d/407/bz.png`):
- 3.5 laid-rope turns on an r 0.085 helix (rope r 0.04) pinched into a lumpy knot, with its cut end showing.
- A black box "thumb wing" stuck out in front of it.

**Why the cord can't simply be a fixed loop on the pin, as Brown's caption reads:**
- The bar's tip rises as it relaxes. For every bend below the set arch, the tip is higher above the pin than the set cord length of 2.355.
- Sliding the slide can only reach bends above the set arch, and it needs 0.82 or more of travel for even a 5% change. Brown's slot leaves the slide about 0.3 of room to the right.
- So the animated setting still needs the cord to be taken up, and a peg is kept.

**Fix** (in `drawing-template-parts.js`, 407 branch only):
- The pin is one turned brass peg:
  - a shank r 0.045 through the slide;
  - a drum r 0.08 in front of the slide cheek;
  - a round head r 0.172 that retains the turns and is turned by the fingers. End-on, it reads as Brown's circle at the pin.
- The peg carries the standard quadrant speed cue, and there is no wing.
- The cord winds close-coiled on the drum at radius 0.12, with pitch 0.084.
- Its fixed end dives into the drum over a quarter turn (the end made fast in a cross-hole), so no cut end shows.
- A quarter turn stays on the drum when the bar is most relaxed. At most 2.05 turns are wound, where there were 3.53.
- When the arch is set (the default view), the last turn leaves in the cord's plane (z 0.33).
- The cord keeps one length; the check is exact to 1e-9.
- 406, which shares the helper, is byte-identical (geometry hash 2174c67f963a613f before and after).

**Captures** (`/dev/shm/p99/d/407/`):
- `bz.png` and `az.png`: four peg close-ups, before and after.
- `b-sheet.png`: before.
- `a-sheet.png`: the plate plus phases 0, 0.25 and 0.5, yaw ±40, pitch ±25, and side.

**Screens:**
- Disconnected parts: 0 detached, 1 near-miss as at HEAD, 0 slivers, 0 lips.
- Coincident faces: 0. Loop seams: 0.
- Body intersections: worst solid 0.
- A new *deforming* pair, peg × wound cord, has depth 0.049. This is the cord end diving into the drum's cross-hole, which is not modelled as a bore.
- The screen's worker needs `--max-old-space-size=12000` for 407: RSS is 8.6 GB, against 4.7 GB at HEAD.

**Tests.** movement-407 passes 7/7. The new assertions check that:
- the free run leaves at the drum's wrap radius, tangentially;
- the turns lie between the slide cheek and the head;
- at most about two turns are wound;
- there is no thumb wing.

**Proposed ledger row:**
- assessment: reasonable
- visibleFlaws: none
- limits (append): "p99: the cord winds on a turned brass winding peg (drum and round retaining head, quadrant cue), end made fast in the drum, at most about two close turns; no thumb wing. A fixed loop on the pin cannot animate the setting: a relaxing bar lifts the tip above the set cord length."

## Deferred
None. `source-presentation.js` was claimed by this lane; only the 310–312 notes changed.

## 309–312: `authored-gravity-escapements.js` (sub-lane p99-d-A)

- **Reviewer:** Claude Opus 5.5, sub-lane p99-d-A, 2026-09-28. No git writes.
- **Claimed files (p99-d):** `src/simulation/authored-gravity-escapements.js`, `src/simulation/baked/gravity-escapement-plates.js` and `src/data/source-presentation.js` (only the 310/311/312 notes changed).
- **Tests changed:** `tests/gravity-escapement-p96.test.mjs` now checks 312's new depth order. `tests/sliver-joints-p86-7.test.mjs` now accepts a 312 stem sunk to the arm mid-plane from either side. The new `tests/gravity-escapement-p99.test.mjs` covers 310's collar and short pins, 311's wheel spacing, impulse-pin length and see-through rod.
- **Plates:** rebaked with `node scripts/generate-gravity-escapement-plates.mjs <id>` for 310, 311 and 312.
  - Every plate's blank and kept area is the same as at HEAD.
  - The 310 and 311 outlines are byte-identical; only their inputHash changed.
  - 312 differs only in one clip count.
  - New inputHashes: 310 `a97d616125f8c894`, 311 `ca403b84ee2af6bb`, 312 `1d6301cdb6e8c7b1`. 309 is unchanged at `01e58fe8248a43d6`.
- **Byte identity:** only 309–312 use this file. 309's geometry hash (all mesh positions, matrices, visibility and shadow flags at three times) is unchanged at `6512a03e7e7013b9`.
- **Captures** are in `/dev/shm/p99/d/A/`:
  - Before: `b3NN-{v0,y40,side}.png`.
  - After: `after/NNN-{v0,yp40,ym40,pp25,pm25,side,back,ph0.25,ph0.5,ph0.75}.png`.
  - Plate sheets: `sheet-NNN.png` (the plate plus the 10 after views). Before/after strips beside the plate: `ba-310/311/312.png`.
  - Close-ups: `a310-collar*.png`, `a312-hubzoom*.png`, and plate crops `p309-B.png`, `p310-*.png`, `p311-fly*.png` and `p312-*.png`.
- **Tests:** movement-309…312, gravity-escapement-p96/p99/working-solids, sliver-joints-p86-7 and p86-sliver-joints all pass (65/65). `models.test.mjs` has no 309–312 blocks.
- **Engagement:** `check-gravity-escapement-engagement.mjs` gives output identical to HEAD for 310, 311 and 312 at 11 phases.
- **Screens (309–312):**
  - Disconnected parts: detached 3/1/0/0 and short-of-pin 6/4/5/0, both as at HEAD, with 0 slivers and 0 lips. There are more near-miss pairs (311: 19→25, 312: 52→91). All the new ones are designed plane clearances of 0.02–0.10: the wheel hub or legs against a pallet, the rod against arm B, and spokes against the small wheel on the same rotor. None is a joint gap.
  - Coincident faces: 312 keeps its two pre-existing pairs (area 0.0003); the others are 0.
  - Body intersections: 0. Loop seams: 0.

### 309 (B's nib): forced, proven with numbers; no change
- **Proof method.** I took Brown's nib point (145, 214) in B's drawn locked pose, carried it with pallet B through the cycle, and tested it against the rendered wheel-teeth mesh at 2001 phases.
- **Brown's point runs inside a tooth** for 560 of the 2001 phases (0.38–0.44 and 0.78–0.89).
- **Points between the model's nib (128.3, 212.3) and Brown's:**
  - The first 10% of the way is clear.
  - From 20% on, the point collides for 126 to 560 phases.
  - So the present nib is already at the limit.
- **Why Brown's point cannot work.**
  - His nib sits at r 154 px about the wheel centre, only 4 px above the root (150.5) and 17 px inside the tip circle (171), at 137°.
  - While A is being cocked, the wheel turns 6° under B and the tooth at 141° sweeps through 137°.
  - To clear it, B would have to be lifted about 17 px at 200 px from C, about 4.9°, before the wheel moves.
  - The pendulum's full 5° amplitude lifts B only 3.6° above its locked pose (magnitude −0.018 to +0.044 rad).
  - A smaller pallet fall does not help, because the collision happens while B is raised, not while it is fallen.
- **Proposed ledger row:**
  - assessment: minor.
  - visibleFlaws: "B's bottom edge drops into its small nib about 16 px left of and shallower than Brown's (point near x 128, not 145). This is forced: Brown's nib, at r 154 px (4 px above the root), is swept by the tooth that passes under B while A is cocked. Clearing it would need a 4.9° pallet lift before the wheel moves; the pendulum's full swing gives only 3.6°."
  - Limits (append): "p99: Brown's nib point, carried with B through the cycle, lies inside a tooth for 28% of it. Points more than 10% of the way from the model nib toward his also collide. The present nib is at the limit."

### 310 (long beat pins): shortened by a deep beat collar
- **Change.** Brown's collar is a clamp block on the rod, and his elevation leaves its depth free. It now reaches forward from the rod (z −1.11) to just behind arm B (−0.366; arm B's back face is at −0.34). It is one extrusion of Brown's pointed-head outline.
  - Each beat pin now bears on the collar's flank over 0.12 of depth.
  - B's pin is a stub: 0.27 long in all, about 0.03 visible between the arm and the collar. It was 0.90 long, with 0.78 exposed.
  - A's pin is 0.81 long, with 0.57 exposed across the gap between the arm planes. It was 1.44, with 1.32 exposed.
  - The kinematics are unchanged: the contact half-width is still 0.275 and the engagement output is identical.
- **Why A's pin can't be shorter.**
  - The collar can't pass an arm plane: each arm's eye round its pin reaches 0.05 inside the collar's flank (eye edge at |x| 0.1175 against the flank at 0.17), so it would collide at contact.
  - The rod can't lie between the arm planes, because it would cross the escape arbor and the lifting pins (p96 numbers).
  - A rod in front of the escapement gives the same numbers mirrored, so the rod stays behind as p96 left it.
- **Proposed ledger row:**
  - assessment: minor.
  - visibleFlaws: "Arm A's beat pin still runs about 0.57 back across the gap between the arm planes to the collar (seen only in rotated views); B's is a short stub."
  - Limits (append): "p99: Brown's beat collar is a deep clamp block reaching from the rod to just behind arm B. The pins bear on its flanks; B's pin is a stub. The collar cannot pass an arm plane, because each arm's eye round its pin reaches inside the collar's flank."

### 311 (rod in front, long pins): the rod in front is Brown's own; pins shorter; rod see-through
- **Verified on the plate.** Brown draws the rod solid at the bottom with a broken-off top below the wheels. That is his convention for a part in front, cut away to show what lies behind, so a rod in front is faithful.
- **The rod is now see-through.** It was opaque over the wheel centre and the lifting pins. It now uses the shared see-through style (as 312 does) instead of being truncated.
- **Wheels closer together.** Brown's text says the wheels are "set wide enough apart to allow the pallets to lie between them". They now sit 0.03 clear of the pallets: planes ±0.33, where they were ±0.54. The rod plane moves from 0.80 to 0.59, still 0.03 clear of the arbor end.
  - The impulse pins are now 0.85 and 0.63 long (were 1.06 and 0.84). Their exposed lengths are 0.75 and 0.53 (were 0.96 and 0.74).
  - The lifting pins and stop stems are shorter too.
  - Plate outlines and engagement are identical.
- **Still forced.**
  - Behind the wheels, the fly's half-span (4.39) sweeps the pins' path (4.05).
  - Between the wheels, the rod would cross the common arbor.
  - So the pins must span the front wheel's depth.
- **Proposed ledger row:**
  - assessment: minor.
  - visibleFlaws: "The impulse pins still run 0.5–0.75 forward from the pallets to the rod in front of the front wheel (rotated views)."
  - Limits (replace the p96 sentence): "p99: the rod stands in front, as Brown breaks it off below the wheels, and is see-through. The wheels sit just clear of the pallets (±0.33). The fly behind and the arbor between the wheels rule out any other rod plane."

### 312 (pendulum in front of the wheel): reordered; the rod hugs the arms
- **Verified on the plate.** Brown's dashed pendulum line runs through open space between C and the wheel, where nothing could hide it, so it is his centre line, not a hidden edge (see `p312-top.png`). The rod still cannot hang behind the large wheel: E and F sit 0.48 and 0.59 from the arbor, inside the spokes (0.19–1.62).
- **Change.** The depth order, back to front, is now: large wheel (−0.485), small wheel (−0.23), arm A, arm B, rod (0.205).
  - Brown draws the star clear of the arms, so the small wheel can sit behind them. The pallet faces now reach back to it, as the stops reach back to the large wheel.
  - The common arbor ends behind arm A, so the rod hangs directly in front of arm B (0.03 clear).
  - E and F are now 0.39 and 0.28 long (were 0.70 and 0.59), exposed 0.31 and 0.20 (were 0.62 and 0.51).
  - The small wheel is thinner (teeth 0.13 deep, where they were 0.18).
  - The pallet stems are 0.11 and 0.22 long (were 0.25 and 0.14).
  - The rod is still see-through.
- **Cost.** The black stops A and B reach 0.28 and 0.39 back to the large wheel (were 0.10 and 0.20). The total of all exposed protrusions falls from 1.80 to 1.51.
- **Proposed ledger row:**
  - assessment: minor (reasonable if the reviewer accepts the dashed line as a centre line).
  - visibleFlaws: "The see-through rod hangs in front of the arms and wheels, where Brown gives only a dashed centre line; the stops A and B reach about 0.3–0.4 back to the large wheel."
  - Limits (replace the p96 pendulum sentence): "p99: back to front, the order is large wheel, small wheel, arm A, arm B, rod. The rod hangs 0.03 in front of arm B, see-through; E and F are short tabs (0.28–0.39). The rod cannot hang behind the large wheel because E and F lie inside its spokes. Brown's dashed line crosses open space above the wheel, so it is a centre line."

- **Loader and see-through tests:** `authored-loader` and `see-through-part` pass 12/12.

### 402: pallet A hangs as Brown draws it; swing widened to 26° so the runs are longer (sub-lane p99-d-B)

- **Files (claimed by p99-d):** `src/simulation/guernsey-anchor.js`, `src/simulation/authored-guernsey-escapements.js` (only the reconstruction note), `src/simulation/baked/guernsey-anchor-402.js` (rebaked), and `tests/movement-402.test.mjs`.
- **Plate check.**
  - Brown's A is a narrow wedge, about 8.5 px wide and 24.5 px tall, hanging point-down from the end of the upper arm. Its left flank leans 7° from vertical and its right flank 13°, with the point at plate (353, 326).
  - The model's A was a blade laid along a tooth's front face. At the plate pose it leaned about 34° off vertical, pointing down and to the right.
  - Brown's toothed spans, measured about B:
    - upper run: internal teeth from 98.7° to 146.7°;
    - lower run: external teeth from 153° to 197.8°, with the arm's end at about 201°.
  - For every one of those teeth to pass the pinions' pitch points, the lever would have to turn from +12.8° to −35.2° on the upper run and from +14.8° to −30° on the lower run: about 43° in all.

#### Fix 1: pallet A (flaw removed)
- A is now Brown's wedge (`hangingPallet`), built in the lever frame:
  - point at (0.92, 0.05), which is (352 px, 327 px), within 1 px of Brown's;
  - top at y 0.504;
  - flanks leaning 7° and 13° from vertical, with a 0.014 round at the point.
- A tooth's front face bears on A's left flank, and the tooth's tip slides off A's point as A withdraws.
- The lower pallet keeps its blade along the front face, seated nose-in-root at the counter-clockwise extreme.
- The upper arm's control point moved from (0.18, 0.62) to (0.26, 0.56), so the arm now follows Brown's arm into the top of A (overlay `work/k2.png`).

#### Fix 2: longer toothed runs (shrunk, not removed)
- **The swing is wider.** The lever now swings 13° either side of a centre 3° clockwise of the plate pose: θ from −16° to +10°, a 26° swing (was ±10°, 20°). It still passes the plate pose at phase 0.
- **Longer runs.** Each run now has 16 meshing teeth (was 13), and every one passes its pitch point.
  - Internal teeth: 98.7–130.7°. The upper free end stays at Brown's 98.7°.
  - External teeth: 155.8–185.7°. The lower arm now ends at 188° (was 182°; Brown's is 201°).
- **Why no wider swing (forced, with numbers):**
  - Near A (wheel angle about 114°), the anchor moves 0.92 radially per radian of lever swing. At the lower pallet (about 185°) it moves 0.99 per radian.
  - Brown's teeth are only 0.24 deep: tips 1.09, roots 0.85.
  - Each pallet has to stay engaged for more than half the swing. Otherwise the wheel runs free while both pallets are out.
  - Those limits cap the swing at about 2 × 0.22 / 0.95 ≈ 0.46 rad (26°) with no margin.
  - A 1,890-configuration scan confirmed this. It varied amplitude (12–16°), centre (−8° to +2°), A's point position, A's flank lean (4–13°) and the lower seat shift. Every working, jam-free solution had an amplitude of 13° or less.
    - At 14–16°, A's wedge is pinched between two teeth and driven into the tooth space (hundreds of unresolved steps), or the wheel runs through 3 to 15 teeth.
  - The swing can't simply be recentred either. The swing's counter-clockwise end is already about +10°, where the upper run meets the left pinion. Using Brown's lower end (−30°) would lose his upper end (+12.8°).
  - The last teeth on the upper run can never mesh. A tooth at 146.7° would need the bar within 5° of the upper pinion, and the bar would overlap it. The usable limit is about 142°.
- **Chosen point.** A 13°, centre −3°, A's point (0.92, 0.05), lower seat shift 10°. This point is inside the working cluster: A's point ±0.015 and seat shift 6–15° all still work.

#### Bake and checks
- **Bake:** `node scripts/bake-guernsey-anchor-402.mjs` gives one tooth per period, closure −2.1e−8 and maxPush 6.6e−4 (was 6.4e−4). `--check` reports it up to date. No other validation report fingerprints these files.
- **Screens (402):**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The 16 near-misses are running clearances, as before.
  - Coincident faces: 0 flagged.
  - Body intersections: worst solid 0.0000.
  - Loop seams: 0.
- **Tests:**
  - movement-402 and guernsey-working-solids: 13/13 pass. They now assert:
    - 16 teeth per run, and a swing of at least 26°;
    - every tooth comes into mesh over [lo, hi];
    - the upper run reaches 98.8° or less, the lower run 185° or more;
    - the lever is at the plate pose at phase 0;
    - A is a narrow point-down wedge with both flanks within 15° of vertical and its point within 0.04 of Brown's;
    - the lower pallet sits flank-flush, nose in the root, at the counter-clockwise extreme.
  - Also passing: display-tooth-passing, authored-loader (6/6) and camera-catalog (1/1).
  - models.test.mjs has no 402 block.
- **Captures** (`/dev/shm/p99/d/B/`):
  - `tile-before.png` and `tile-after.png`: the plate plus default, phases 0.25 and 0.75, yaw ±40, pitch ±25, side, and the A and arm zooms.
  - `zA-after.png`: A at phases 0, 0.2, 0.45, 0.7 and 0.9, rotated A, and the lower run.
  - `work/cur-A.png` (before) and `work/k2.png` (after): 2D outline overlays on the plate.
  - Raw shots are in `before/` and `after/`.

#### Deferred
- `src/data/display-profiles.json` (not claimed; shared): regenerate 402 with `node scripts/measure-display-profiles.mjs 402`. The wheel bake changed, so the peak speed and bounds may shift slightly.
- `source-presentation.js`: 402's note still says "single curved arm". That is still broadly true, so no change is needed.

#### Proposed ledger row (402)
- **assessment:** minor
- **visibleFlaws:** "The upper run's teeth stop at 130.7°, 21° short of the bar, where Brown's reach 146.7° (no tooth past about 142° could mesh: the bar would strike the upper pinion), and the lower run ends at 188° where Brown's reaches 201°: the 0.24-deep teeth limit the anchor to a 26° swing."
- **limits, replace the p94 swing sentence with:** "p99: pallet A is Brown's narrow wedge hanging point-down (flanks 7° and 13° off vertical; the tooth's front face bears on its left flank). The lever swings 13° about a centre 3° clockwise of the plate pose (−16° to +10°), the most the anchor allows: the pallets move 0.92–0.99 radially per radian against 0.24-deep teeth, and a scan of 1,890 configurations found no working swing wider than 26°. Sixteen teeth on each run all mesh; the upper run reaches Brown's top end."
