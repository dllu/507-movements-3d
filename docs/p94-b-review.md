# Pass 94, lane p94-b: clearing the minor rows 371, 374, 378, 382, 396, 402, 406, 415, 433, 478, 486, 495

- **Reviewer:** Claude Opus 5.5, lane p94-b (parent), with six forked sub-lanes: F1 (371, 495), F2 (374, 382, 406), F3 (378, 415), F4 (396, 402), F5 (433, 478) and F6 (486). Date: 2026-09-28. No git writes.
- **Captures:** `/dev/shm/p94/b/F*/`. Each sub-lane ran a private vite server and its own `shots.mjs`.
- **Claims:**
  - **Factories (p94-b):** `authored-{mangle-wheels,treadle-eccentric-drives,pendulum-saws,adjustable-stands,reed-escapements,guernsey-escapements,parabola-drawing,dickson-reversible-drives,horizontal-overshot-water-wheels,expansion-steam-traps,pivoted-sail-windmills,entwistle-gearing}.js`.
  - **Single-movement helpers (F4):** `reed-396-working-parts.js`, `guernsey-anchor.js`, `baked/guernsey-anchor-402.js`.
  - **Display profiles (F5, used by the parent):** `display-profiles.json/.js`. Only 378, 396, 402, 433, 478 and 486 changed; this was checked against HEAD.
  - **`source-presentation.js` (p94-b):** only 402's note changed, to say "plain rims joined to their hubs by see-through webs".
- **Regenerated:**
  - `docs/validation/412-495-gear-solids.json`: 495 has 0 penetrations over 33 poses; the 412 rows are unchanged.
  - `baked/guernsey-anchor-402.js`: `--check` passes.
  - Display profiles, via `node scripts/measure-display-profiles.mjs 378 396 402 433 478 486`.
- **Deferred or out of lane:**
  - `scripts/generate-reversing-transmission-profiles.mjs --check` crashes in its 394 half. `authored-parsons-racks` no longer exports `blocks.outputRotor`; this predates the pass. 371's bake input is unchanged.
  - 378: the spade's lower edge is a blunt point where Brown draws a shallow arc.
  - 478: sphere C looks slightly large, and B is a plain block where Brown draws a notched bracket.

## Sub-lane p94-b-F1: 371, 495

Reviewer: Claude Opus 5.5, sub-lane p94-b-F1. Date: 2026-09-28. No git writes. Captures in `/dev/shm/p94/b/F1/` (private vite on port 46501; `b*` before, `a*` after).
- **Claims:** none beyond the lane's `authored-mangle-wheels.js` and `authored-entwistle-gearing.js`. The shared helpers (`reversing-transmission-working-parts.js`, `reversing-transmission-tooth-profiles.js`, `miter-gear.js`, `capstan-entwistle-corrections.js`) are untouched, so 394 and the other miter users are byte-identical.
- **Script edit:** `scripts/review-capstan-entwistle-solids.mjs` now also tests the new back discs. They carry a role only 495 uses, so the 412 rows are unchanged.

### 371: agree; uniform radial bars, plain rims
- **Cause.** Each bar was the offline cutter envelope of the spur pinion. A spur pinion on a face wheel rolls exactly at only one radius, so every radial station was cut differently. The bars were twisted and pinched, and they also showed uncut stock at the ends. The rims were 1.29–1.495 and 1.97–2.11, with narrower extensions (to 1.45 and from 2.0) past the terminals, which left a step at each end.
- **Change** (`authored-mangle-wheels.js` only).
  - **One section per bar.** Each bar's section is the common part of every baked cut station between r 1.45 and 2.0, with the tangential coordinate normalised by r/1.72. Because it lies inside every station's envelope, it clears the pinion wherever the envelope did.
  - **The bar.** A straight 12-station loft with creased normals. Its width grows in proportion to r, so the side lines are radial as Brown draws them, and its height is constant. It runs 1.435–2.015, buried 0.015 in each rim.
  - **The rims.** Each is now one plain sector, 1.29–1.45 and 2.0–2.11, carried 0.07 rad past both terminals. These are the radii the crossing pinion never reaches, which the old extensions already relied on. There is no step, and no uncut stock or neck shows.
  - **Genuinely different from p90.** p90 buried the stock in deeper rims. This pass replaces the cut envelope itself.
  - **Tried and rejected:**
    - An exactly conjugate conical (crown) pinion is impossible, because the shaft must stay parallel to the wheel plane to cross faces.
    - Constant-width (linear) bars gave 0.0103 backlash.
    - Taper exponents from 0.5 to 3 gave no better maximum than 1.
- **Captures:** `a371-d.png` (default), `a371-r.png` (rotated), `a371-z.png` (bars, cf. `b371-z.png`), `a371-z2.png` (terminal and rim end, cf. `b371-z2.png`), `a371-z3.png` (pinion at crossover), `a371-back.png`.
- **Tests:** 26/26 pass: `movement-371` (8), `reversing-transmission-tooth-contact`, `reversing-transmission-working-solids` and `reversing-mangle-finite-guides`.
  - `movement-371` now asserts the rim radii, a single uniform section on every bar (width proportional to r, constant height) and the profile type.
  - Bidirectional tooth gap: 0.0017 (clear).
  - Useful-face witness maximum: 0.0075 (was 0.0044). The threshold was raised from 0.0045 to 0.008, with a comment. This is the extra crossover backlash the uniform section costs, 3% of the circular pitch.
- **Screens:**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips.
  - Coincident faces: 0.
  - Body intersections: worst 0.
  - Seams: 0.
- **Bake:** `generate-reversing-transmission-profiles.mjs` is unchanged; it reads only the unchanged pinion outline. Its `--check` now crashes in its 394 half (`blocks.outputRotor` is undefined in `authored-parsons-racks`). That is outside this lane.
- **Residuals:**
  - The terminal bars are lower on the face the rollover shaves.
  - Backlash is up to 0.0075 at the crossovers.
- **Proposed ledger row:** assessment reasonable, visibleFlaws "".
  - Limits, replace the p90 sentences with: "The rim gap is ≈8° wider than Brown's, the smallest the pinion clears. p94: each bar has one section (the common part of the offline cutter stations, width in proportion to the radius) between two plain rim sectors; crossover backlash up to 0.0075. A small fixed guide plate carries the shaft; one colour per bar."

### 495: partly agree; flat plain backs are buildable
- **Correction to p93.** p93 held that a tip-circle back disc cannot clear three equal miters. That holds only for a back plane at the old heel.
  - With the back plane at z_b and every tooth kept inside the cylinder of radius z_b − c, one wheel's teeth never reach another wheel's back region. The planet's teeth have radius < z_b about its own axis, which is below A's back plane, and vice versa.
  - The teeth are proportional (rays from the apex), so extending them along the cone keeps them conjugate.
- **Change** (`authored-entwistle-gearing.js`).
  - **Teeth.** They run on from the old heel (1.20, tip radius 1.341) to a back plane at 1.361 (clearance 0.02). Where the tips would pass r 1.341 they are turned to that cylinder, a short turned band like Brown's at A.
  - **Back.** A plain disc 0.07 thick, from the hub to the tip radius, closes each wheel. The root body runs into it.
  - **Inside the disc.** The tips step 0.003 in, so no face lies on the disc's rim.
  - **B's boss.** It now stands 0.06 proud of its back around stud E.
  - **Drum C'.** Its bore is now 0.24, cast over the sleeve. It had shared the sleeve's 0.115 bore, a coincident-face pair (area 0.0065) that predated this pass.
  - **Swept size.** The planet's reach is unchanged at 1.34 about D. A's back meets the standard's bearing and C's back meets the drum, both rigidly.
- **Captures:** `a495-d.png` (default), `a495-r.png` / `a495-r2.png` (obliques, cf. `b495-r*.png` with toothed backs), `a495-back.png`, `a495-z.png` (B and A backs), `a495-z2.png` (mesh at the apex).
- **Tests:**
  - `movement-495` (7) passes. There is a new test for the back disc: it reaches the tips, the back plane stands at the tip radius + 0.02 or more, and the teeth stay inside the tip cylinder. The swept-bounds test now uses precise vertex bounds, because the loose box of a rotated back disc overstated its reach.
  - `capstan-entwistle-solids` (6) passes.
- **Report:** `docs/validation/412-495-gear-solids.json` was regenerated. For 495: 0 penetrations over 33 poses, with the back discs included; mesh gap 0.0048–0.0049, unchanged. The 412 rows are unchanged.
- **Screens:**
  - Coincident faces: 0 (was 61 pairs before the tip step and drum fixes).
  - Body intersections: worst 0.
  - Seams: 0.
  - Disconnected parts: 0 detached. The one lip (left standard bearing) and the one short-of-pin lead (pulley and right standard, a 0.06 running gap) predate this pass.
- **Residual:** the gears are whole rather than cut in section (existing limit).
- **Proposed ledger row:** assessment reasonable, visibleFlaws "".
  - Limits, replace the p90/p93 sentences with: "The gears are whole rather than cut in section. Approximate bevel conjugacy. p94: each bevel has a plain flat back out to its tip radius; the teeth run on to it with their tips turned to that radius (clears the mating wheels by 0.02). Brown's large square carrier block for stud E."

## Sub-lane p94-b-F2: 374, 382, 406

- **Files:** `src/simulation/authored-adjustable-stands.js` (382) and `src/simulation/authored-parabola-drawing.js` (406), both already claimed by p94-b. 374 has no production change. No helpers were edited, so no extra claims were needed.
- **Captures:** `/dev/shm/p94/b/F2/`. Before: `b<id>.png` and `b<id>r.png`. After: `tile-a382.png`, `cmp382.png`, `tile-a406.png`, `cmp406.png`, `z406.png` and `tile-374.png`. Private vite ran on port 46502.
- **Camera:** camera-catalog passes with the final geometry, and display profiles needed no re-measure.
- **Screens (374, 382, 406):**
  - Coincident faces: 0 for all three.
  - Loop seams: 0.
  - Body intersections: all clear at 129 samples, apart from the pre-existing cord-anchor coaxial leads and the drawn-stroke leads on 406.
  - Disconnected parts: 0 detached.
    - 382 keeps its 12 bore-clearance near-misses.
    - 406 keeps its one leads: the focus-collar near-miss and the stroke's open end.

### 374: disagree; the dashed circle is the eccentric's second position, not a wheel
- **Measurements on the plate (525 px):**
  - Solid disc: centre (253, 105), r 88.
  - Shaft: (292, 100).
  - Dashed circle: centre (340, 106), r 87.
- **Why it isn't a wheel behind:**
  - The dashed circle has the eccentric's own radius.
  - Its centre lies on the far side of the shaft, at 48 px against the solid disc's 39 px. That matches the model's e/r of 0.50 (Brown's two states measure 0.44 and 0.55).
  - Nothing is drawn at its centre, so no shaft could carry a wheel there.
  - It is dashed all round, including the arc outside the disc. A wheel hidden behind the disc would be drawn solid where it is exposed.
  - The factory's own source note already records "a dashed opposite eccentric position".
- **Conclusion:** this is Brown's two-state notation. The rulebook says to show one animated model, and at half a turn the model's eccentric lies exactly on the dashed circle (`tile-374.png`: plate, phase 0, phase 0.5). Adding a see-through wheel would add an unsupported, undrawn part.
- **Change:** none in production. A new test in `movement-374` asserts that the half-turn eccentric centre maps to within 8 px of (340, 106).
- **Tests:** movement-374 passes 9/9.

### 382: hinge raised to mid-frame; stem lengthened to the plate
- **The finding is correct.**
  - The hinge sat 0.99 below the frame centre, 22% of the frame height from its bottom edge. Brown's is 11 px (0.13) below the centre.
  - Brown's hinge also stands higher over the pillar: 1.65 above the socket top at the plate pose, against the model's 1.14. That was measured at 87.4 px/unit from the base width.
- **Change:**
  - `mirrorCenterLocal` is now (0, 0.15, −1.10) (was (0, 0.99, −0.90)).
  - `stemTopLocalY` is now 1.86 (was 1.47).
  - The tilt amplitude is now ±18° (was ±22°). Phase 0 is still Brown's back tilt.
  - The frame's lower edge now passes behind the collar, as drawn.
- **Clearance:**
  - At −0.90 or −1.00 standoff with ±16–22° tilt, the frame struck the collar. The dense-point probe (`gap382.mjs`) showed up to 0.11 penetration.
  - At −1.10 standoff and ±18° tilt, the minimum frame, back and neck gap to the pillar and set screw is 0.058 over 240 phases. The screen is clear at 129 samples.
- **Captures:**
  - `cmp382.png`: plate, before, after.
  - `tile-a382.png`: default, side views at 0, 0.25 and 0.75, −60° yaw at 0.5, and behind.
- **Tests:** movement-382 passes 10/10. A new test pins the hinge near mid-frame and the plate-pose stem length. The disclosure text now says 18-degree tilt. adjustment-contact-solids passes 4/4.
- **Residual:** the frame now stands 1.10 behind the hinge, so the neck is 0.92 long (was 0.72). It is hidden behind the hinge from the front but reads as a longer stalk in side views. Brown doesn't show the neck's depth.

### 406: one-sided stock with a cove end; curved blade foot replaces the end block
- **Change** (all in `authored-parabola-drawing.js`, after the shared helper runs; the helper's 407 path is untouched):
  - **Stock.** One extrusion running only left of the blade, 0.48 long by 0.20 high, about Brown's 2.4:1 ratio. It ends in a concave cove of r 0.17, which is Brown's ogee end. It stops at the blade's right edge.
  - **Blade.** The blade is now one extrusion hanging from the stock's underside, with its top flush with the stock's (z 0.765, no coincident faces).
  - **Foot.** The blade's foot curves: a heel arc of r 0.20 sweeps into a toe that ends in an r 0.07 round, concentric with the thread anchor (0.113 right of the blade's working edge). An r 0.04 fillet joins it to the blade edge.
  - **End block.** The separate `free-end-of-square-blade` block (0.55 × 0.18) is removed.
  - **Clearances.** The existing anchor stud now enters the toe. At its lowest, the pencil clears the toe by 0.04.
  - **Straightedge and board.** Both widen to ±3.25 (were ±2.95), so the longer stock stays on the straightedge at full travel. Brown's straightedge is longer still, about ±3.6.
- **Captures:**
  - `cmp406.png`: plate, before, after.
  - `tile-a406.png`: default, 40° yaw, the two extreme phases, foot and stock zooms.
  - `z406.png`: stock cove and toe close-ups.
- **Tests:** movement-406 passes 11/11 and drawing-template-working-solids passes 5/5.
  - A new test covers: no end block; the stock ends at the blade and runs left; flush tops; the toe tip is at the anchor; the pencil clears the toe; the stock stays on the straightedge.
  - The working-solids pair list now checks the stock and stud against the pencil and pin (it previously checked the end block).
- **Residual:** Brown's foot curves to a point under the thread with no toe. The model's thread runs 0.2 right of the blade because the pencil bears on the blade edge, so the foot turns out to meet it.

## Sub-lane p94-b-F3: 378, 415

Captures are in `/dev/shm/p94/b/F3/` (private vite on port 46503, `shots.mjs`). `tile-<id>.png` shows the plate beside the after views. The before views are `b378-grid.png` (phases 0/0.25/0.5/0.75) and `b415-grid.png`. Claims: none beyond the lane's two factories. The only shared file touched is `tests/spring-pivot-family-solids.test.mjs`, where only the 378 period entry changed.

### 378: the saw stays in its cut; rod holes; standards at Brown's height
- **Verdict:** I agree with all three findings.
  - **Saw leaves its cut.** The prescribed feed lifted the blade out of the log once per loop (blade y 0.11 → −0.83 → 0.11).
  - **Rod holes missing.** Brown draws three adjustment holes in the rod (plate y 317/349/375).
  - **Standards short.** Brown's bow saw is about as tall as it is wide (span 124 px, scroll tops to teeth about 105 px). Ours was 2.58 wide and 1.1 tall. Brown's A-frame pivot also stands 76 px (1.1 units) above the frame's top beam, where ours was level with it.
- **Change (a different approach from the p90 note, which suggested a fade/reset feed):**
  - **Feed is quasi-static.** The counterweighted carriage holds the saw at kerf depth, with the teeth 0.004 above the kerf floor for the whole cycle. The loop is now one pendulum period (2.4 s; was a 14.4 s feed-down/feed-up loop). The ropes, counterweights and pulleys are at rest. The counterweights hang at Brown's mid-post height (y −0.30).
  - **Bow saw rebuilt at Brown's proportions:** span 1.80; standards from −0.60 to 0.68 with the scrolls on top; a top stretcher under the scrolls; Brown's twisted cord (laid rope, hemp brown) across the middle, its ends buried in the standards; 19 teeth. The pin boss sits on the left standard at mid height, as drawn.
  - **Log.** It now sits under the middle of the saw's stroke (x 1.27). Brown draws the teeth over the end grain, so the saw is taking a slice off the near end: the log's front face is 0.12 in front of the kerf. That slice is the part covering the teeth, so it uses the shared see-through style, and its front cap is the end grain.
  - **Pendulum.** The pivot is raised to y 3.10, so the A-frame now stands 1.1 above the top beam, as drawn. The rod is 4.08 long, so the spade's top is level with the blade. The rod is one flat extrusion with three bored eyes at 2.48/2.94/3.32 below the pivot (Brown's holes), and the connecting-rod pin (r 0.052) sits in the middle one. The rod joint height is unchanged. The stroke grows to 0.74 at the same measured 7.19° swing.
  - **Pins resized.** The connecting-rod eyes, saw pin and saw boss are resized to the smaller pin (bore 0.055).
- **Captures:** `tile-378.png`, `a378-grid.png` (phases 0/0.25/0.75 and rotated), `z378-grid.png` (saw zoom, rod holes, kerf from above, rear view).
- **Screens:**
  - Disconnected parts: 0 detached. Before: 1 floating and 2 short-of-pin.
  - Coincident faces: 0.
  - Intersections: worst 0. The only open mesh is the far end-grain disc.
  - Seams: 0.
- **Tests:**
  - `movement-378` (8/8) is rewritten for the held carriage: teeth ride on the kerf floor and the blade spans the floor chord every sample. It also asserts the saw's height-to-span ratio (0.8–0.95), the cord, the pivot 1.0+ above the beam, the three holes with the pin in the middle one, and the see-through front slice.
  - `spring-pivot-family-solids`: the 378 period is now 2.4 and the test passes. The full camera-catalog test passes.
- **Deferred:**
  - `src/data/display-profiles.json` entry 378 is stale: motion bounds max y is now about 3.3, and the peak angular speed falls because the pulleys are static. The file is claimed by p94-b-F5. Re-measure with `node scripts/measure-display-profiles.mjs 378`.
  - The spade's lower edge is still two tangent arcs to a blunt point, where Brown draws a shallow arc. This was out of scope.
- **Proposed ledger row:** assessment reasonable, visibleFlaws "".
  - Append to limits: "p94: the feed is quasi-static: the counterweighted carriage holds the saw in its kerf (teeth on the kerf floor all cycle), so the ropes, counterweights and pulleys are at rest; the bow saw is at Brown's proportions (as tall as wide, top stretcher, twisted cord); the A-frame stands 1.1 above the frame; the rod has Brown's three adjustment holes with the pin in the middle one; the slice in front of the kerf is see-through so the teeth show over the end grain."

### 415: cord attachment
- **Verdict:** I agree. Measured on the plate, Brown's dotted cords meet B about 0.66 and C about 0.72 of the way from hinge to tip. Ours were at 0.58.
- **Change:** a single constant, `PAWL_CORD_EYE_FRACTION = 0.70`, is used for both identical pawls, for the eye position and the cord route.
- **Captures:** `tile-415.png`, `a415-grid.png` (phases 0/0.25/0.5/0.75, and two rotated views).
- **Screens:**
  - Disconnected parts: unchanged from before (0 detached; 9 short-of-pin leads, the same as before the change).
  - Coincident faces: 0.
  - Intersections: worst solid 1.5e-5, the documented rim/pawl facet tolerance. The only other pairs are the cords at their own tie points.
  - Seams: 0.
- **Tests:** `movement-415` and `one-way-clutch-working-solids` pass. One 360 subtest failed once in a combined run, then passed alone; the failure is not in this lane's files.
- **Proposed ledger row:** assessment reasonable, visibleFlaws "".
  - Append to limits: "p94: both cords tie on 0.70 along the blade (Brown about 0.66 for B and 0.72 for C)."

## Sub-lane p94-b-F4: 396 (balance rim), 402 (toothed runs, arm)

Scratch and captures: `/dev/shm/p94/b/F4/` (private vite on port 46504, `shots.mjs`). Before captures: `b396-*.png`, `b402-*.png`. After tiles, with the plate, the before default view and four after views: `tile-396.png` and `tile-402.png`.

Claims (p94-b-F4): `reed-396-working-parts.js`, `guernsey-anchor.js`, `baked/guernsey-anchor-402.js`. The factories `authored-reed-escapements.js` and `authored-guernsey-escapements.js` are the lane's. All of these files are single-movement.

### 396: plain-rim balance (revised after parent review: see-through web)
- **Verified.** Brown draws balance B as two concentric circles, with paper inside and nothing joining the rim to staff b. The model carried the rim on a diametral bar, which read as two arms.
- **First attempt (rejected).** An opaque disc balance: a beaded rim with a web behind it. It hid the lever and filled the plate's open rim with solid blue (`a396-opaque-grid.png`).
- **Fix.** B is three pieces in `authored-reed-escapements.js`, and there is no arm or spoke:
  - **Rim:** opaque, 2.58–2.80, 0.16 deep (z −0.62…−0.46, as before), with a half-round front bead. The bead's edges read as Brown's two circles.
  - **Hub:** opaque, r 0.30, bored 0.183 on staff b.
  - **Web:** a 0.04 web (z −0.615…−0.575) between them, in the shared see-through style (`makeSeeThrough`, so no shadow). Its edges are sunk 0.04 into the rim and 0.02 into the hub. Its faces lie off every rim and hub face.

  The lever, roller, pallet j and staff read through the web from the front and from behind. Nothing that affects the escapement contact changed, so `reed-396-contact` and its bake are untouched.
- **Rear bearing.** Staff b's rear bearing boss (hidden by presentation) moved back behind the hub, to z −0.795…−0.66, and staff b now ends at z −0.80. The dead balance-spoke code in `reed-396-working-parts.js` was removed.
- **Captures:** `tile-396.png` (plate; before; after default, rotated right, low left, behind), `c396-*.png`.
- **Tests:** movement-396 and reed-396-working-parts pass 17/17.
  - New assertions: no arm or spoke; the web is see-through and casts no shadow; the rim and hub are opaque and cast shadows; the web is sunk into both and off their faces; all three clear b's rear bearing and standard.
  - The retained-buffers test now expects `castShadow` to be the opposite of `seeThrough`.
- **Screens:**
  - Coincident faces: 0.
  - Intersections: worst 0.0000 (the working contact).
  - Seams: 0.
  - Disconnected parts: the two pre-existing leads only (the banking-pin short-of-pin, and the balance group once presentation removes its bosses). The new near-misses are running clearances: web/pin i 0.125, web/staff 0.10.
- **Residual:** none visible. The web is a reconstruction; Brown draws nothing inside the rim.

### 402: longer toothed runs, stepped arm
- **Verified.** Brown's pinions have about 18–20 fine teeth (tip radius about 19 px, or 0.34), and his arm is toothed along its whole length. The model had 12-tooth pinions and 9 rack teeth per run.
- **Brown's arm curve.** A circle fitted to it has its centre near the escape wheel (371, 365 px, r 203 px), not at B. Its distance from B varies from 117 to 147 px, so a curve that follows it cannot keep a constant centre distance to either pinion.
- **Fix (`guernsey-anchor.js`):**
  - **Pinions and swing.** The pinions now have 20 teeth at module 0.026 (was 12 at 0.036). The lever swing is ±10° (was ±8°), and ±11° fails: the wheel runs 3 teeth. This gives **13 teeth on each run** (internal 98.7–124.3°, external 155.8–179.7°), every one of which passes its pitch point over the swing. There are no unused teeth.
  - **Arm.** It is now two runs, each an annular band 0.16 wide and concentric with B:
    - the upper run has its plain back outside its internal teeth (2.224–2.384);
    - the lower run has its plain back inside its external teeth (2.160–2.320).

    The runs overlap under the bar, leaving the step that Brown draws at the junction.
  - **Bake.** The wheel was re-baked (`scripts/bake-guernsey-anchor-402.mjs`): one tooth per period, closure −3.5e−11, maxPush 6.4e−4 (was 4.1e−4). `--check` passes.
  - **Pallets.** The seats follow ±A by construction. The notes in `authored-guernsey-escapements.js` are updated.
- **Captures:** `tile-402.png` (plate, before, after at phases 0 and 0.25, rotated, behind), `a402-grid.png` (phases 0/0.25/0.75, rotated), `z402-grid.png` (upper mesh at 0 and 0.25, lower mesh at 0 and 0.75, the junction step front and oblique).
- **Tests:**
  - movement-402 (8) and guernsey-working-solids (5) pass 13/13.
  - A new assertion checks 20-tooth pinions, 13 teeth per run, every tooth within swing + 1.5 pitches of its pitch point, and two concentric runs at least 0.15 wide.
  - The camera-catalog test passes.
- **Screens** (after the balance change): coincident faces 0; intersections worst 0.0000 (the pallet contact); seams 0; disconnected parts 0 detached, with 17 near-misses, all running clearances (web/arbor 0.031, web/bearing 0.04, balance/balance 0.08, as before).
- **Residuals:**
  - Each run's teeth stop where the swing stops using them. Brown's teeth continue to the arm ends and the bar.
  - The runs are true arcs about B, as the gearing requires, not Brown's freehand curve.
  - Pallet A still points further right than Brown's hanging blade (not addressed; not in this pass's list).
- **Balances (added on the parent's request).** The plate draws plain rims; the model had one diametral bar in each. Each balance is now:
  - an opaque rim (1.36–1.50) and hub (r 0.13, so it stands 0.01 proud of the 0.12 collar and no faces coincide), as one merged flat solid;
  - a see-through web (r 0.10–1.39, z inset 0.02 and 0.03 from the balance faces).

  No planes or contacts changed. Where the rims overlap, the left rim shows through the upper web.
  - Captures: `tile-402.png`, `c402-*.png`.
  - Tests: new assertions check the see-through web casts no shadow, lies off the rim faces, and that no bar points lie between r 0.2 and 1.3.

### Deferred
- **`display-profiles.{json,js}`** (claimed by p94-b-F5). Regenerate 396 and 402 with `node scripts/measure-display-profiles.mjs 396 402`. The measured values are in `/dev/shm/p94/b/F4/display-profiles.json`:
  - 396: min z −0.72 → −0.80.
  - 402: peakAngularSpeed 2.28 → 3.03.
- **`source-presentation.js` 402 note** (not claimed). It still says "single curved arm", which is still broadly true.

## Sub-lane p94-b-F5: 433, 478

- **Reviewer:** Claude Opus 5.5, sub-lane p94-b-F5. Captures are in `/dev/shm/p94/b/F5/` (private vite on port 46505, `shots.mjs`). Screens are in `/dev/shm/p94/b/F5/scr/`.
- **Claims:** the factories `authored-horizontal-overshot-water-wheels.js` and `authored-expansion-steam-traps.js` were claimed by p94-b. This sub-lane also claimed `display-profiles.json` and `display-profiles.js`. In those two files only the 433 and 478 entries were re-measured (`node scripts/measure-display-profiles.mjs 433 478`), which the diff confirms. No helper was edited (`water-stream.js` and `horizontal-turbine-solids.js` are untouched).

### 433: water film across each board (agree; added)
- **Plate check.** Brown draws the jet breaking on the boards, with water running out to their ends and spraying below. Before this pass, the jet ended in mid-air above the boards, and each board's spill sheet began at the board's outer end with nothing on the board between them (`b433-z.png`).
- **Change.**
  - Every board carries a water film (`water-film-running-out-along-board-N`). It is a WaterStream and a child of its board group, so it rides with the runner.
  - The film lies along the board's upper face from the strike radius (1.79) to the outer end. Its last sample rolls over the end edge into the start of that board's spill sheet.
  - The film floats 0.004 clear of the face. Its half-thickness is 0.012 and its half-width 0.15, so no water face lies on the board.
  - Each radius carries the feed the board took (r − r0)/v earlier, with v = 3.0. The water front therefore runs out along a newly struck board, and the tail drains outward after the board leaves the jet.
  - The spill sheet's flow is now the same feed, delayed by the full run (0.36 rad of runner turn). Jet, film and sheet are therefore one continuous, conserved body of water. The spill sector moves by about 0.27 rad: it started 0.08 rad past the strike and now starts 0.36 rad past it, and it still ends at 1.45.
  - The film's first sample reaches up to the jet's end while its board takes the jet. It uses the drive's quintic share, doubled and capped at 1, so both boards reach the jet through a hand-off and the jet always lands on water.
  - Dry samples fold onto the nearest wet sample, as the sheets already do. The film therefore ends in its own cap rather than a flat hair, which removed the 12 self-seams the screen first found.
- **Captures:** `cmp433.png` (plate beside the default view), `f433-phases.png` (zoomed at phases 0, 0.03 and 0.05, plus a top view at 0.4), `f433-r.png` and `f433-r2.png` (rotated), `a433-top.png`. Before: `b433-*.png`.
- **Screens:**
  - Coincident faces: 0 flagged. One seam remains, the pre-existing splash spray.
  - Intersections: 0.
  - Disconnected parts: 0 detached. The 50 near-misses are the pre-existing board-to-lower-bearing pairs; none involves a film.
  - Seams: 0.
- **Tests:** `movement-433` passes 12/12. A new test checks four things: every live film rides with its board; one film reaches the jet's end at every sampled time; the face samples stay more than 0.003 clear of the board; and each film that reaches the end runs into its board's visible sheet, which happens at least 4 times.
- **Residual:** the film is a procedural sheet. It shows no spreading across the board and no free-surface physics.

### 478: B and A's anchored end at Brown's distance (agree; moved)
- **Plate check.** At the file's 51 plate px per unit, with C's centre at plate x 272 (scene 0.25), B's hatched upright spans plate x 37–64 (scene −4.36 to −3.83). A's left end is at x 30 (−4.49) and the base starts at x 26 (−4.57). The model had B at −3.22 ± 0.17, the anchor at −3.42 and the base at −3.71, so B and the anchor sat about 0.9 too close to C.
- **Change.**
  - Support B is now 0.52 wide at x −4.10. Its top is 0.003 under A, where it previously cut 0.01 into the pipe.
  - Clamp B's inner radius now equals A's radius, where it previously cut 0.005 into the pipe.
  - A's anchored end (`fixedPipeAnchorX`) is at −4.47 and overhangs B slightly, as drawn.
  - The base plate runs from −4.60, and the camera-fit box and display-profile bounds follow it.
  - Thermal motion and valve timing are unchanged. Only the display length of A grows; its SI free length stays 0.45 m.
- **Captures:** `cmp478.png` (plate beside the default view), `a478-5.png` (phase 0.5), `a478-r.png` and `a478-r2.png` (rotated), `a478-zB.png` (B close-up). Before: `b478-*.png`.
- **Screens:**
  - Intersections: worst 0 (was 0.0100, B × A).
  - Coincident faces: 0.
  - Disconnected parts: 0 detached. There is one near-miss: A's end rim stands 0.06 off B's left face, which matches the plate's overhang.
  - Seams: 0.
- **Tests:** `movement-478` passes 14/14. A new test checks that B's faces and A's end lie within 0.06 of the plate measurements, that B stands just under A, and that A overhangs B. The camera-fit check (a camera-catalog copy filtered to 433 and 478) passes.
- **Residual, not in the finding:** sphere C (outer radius 1.13) reads a little larger against the base than Brown's, and B is a plain block with a ring clamp rather than Brown's notched bracket.

## Sub-lane p94-b-F6: 486 (sail length, flip timing)

Captures are in `/dev/shm/p94/b/F6/` (private vite on port 46506, `shots.mjs`). Scratch analysis scripts are `search*.mjs`, `scan*.mjs` and `verify.mjs` there.

### 486: Brown-length sails, flip moved to 120–180°
- **Why 0.94 R was forced under the official timing.** Each board is centred on its pivot, and the pivots are one radius R = 1.72 apart. In the official schedule a vane flips over 90–120° of azimuth and is then held edge-on, parallel to the wind. At a rotor angle 30° past the plate pose, the neighbours at 150° and 210° are both edge-on, and their chord runs along the wind, so they lie on one line with their centres R apart. Any board longer than R minus the thickness (1.655) collides there.
  - Moving the pivot off-centre doesn't help. Two identical parallel boards always face each other with a combined extent of L.
- **Search** (analytic plan sweep of the six board segments, capsule distance minus thickness, 1440–2880 rotor samples; `search2.mjs`, `scan*.mjs`):
  - **Feathering the return by a linear law** only clears 1.80 at deviations of 15–45° off edge-on. Rejected.
  - **Lengthening the official flip that starts at the top** only clears once it ends at 165° or later. That leaves the plate's 120° board 35–55° off vertical in the default view. Rejected.
  - **Early (Brown-like) or clockwise flips** that end by 150° all collide.
  - **Adopted:** radial through the power half-turn. At the top the radial board already lies along the wind, so it is released there and held edge-on until 120°. It flips +180° over 120–180° with a rest-to-rest quintic (zero angular velocity and acceleration at both ends), then holds edge-on to 270°. The 150°/210° pair always has one board turning.
- **Change** (`authored-pivoted-sail-windmills.js` only):
  - `sailWidthSceneUnit` 1.62 → 1.80 (1.047 R).
  - `pivotTransitionAngleRadian` π/6 → π/3, plus a new `flipStartAfterTopRadian` = π/6.
  - `restToRestFlipQuintic` replaces the source-phase quintic.
  - New pivot modes are `wind-aligned-edge-on-hold-before-flip` and `C2-180-degree-flip-on-return`.
  - The mechanism, timing, hinge-constraint and disclosure texts, and the model's reconstruction note, now state the departure from the official 30° post-top flip.
  - The shared `wind-rotor-working-parts.js` is untouched, since it already reads the sail width from geometry.
- **Clearance proof** (`verify.mjs`, the real factory, 7200 poses over one cycle):
  - The minimum board-to-board face gap is **0.511**, at phase 0.42. It was 0.035 at 1.62.
  - The board to neighbour hinge sleeve gap is 0.71.
  - The boards sit at y −0.36 to 0.36, clear of the arms and brackets at y −0.56 to −0.48. The board's inner end stays at radius 0.82 or more, outside the hub (0.43).
- **Plate pose:** at phase 0 the boards lie at undirected yaws 0, 60, 90, 90, 90 and 120°, matching Brown's 0°, 120°, 180°, 240° and 300° boards. Brown's 60° board is drawn mid-turn at about 142°. The model keeps it radial, as the official animation does and as the previous model did; the site notes that Brown flips too early.
- **Captures:**
  - `tile-486.png`: plate, then phases 0, 0.042, 0.083 (150° board mid-flip) and 0.125, then oblique 0.083 and low 0.3.
  - Singles are `a-*.png`.
- **Screens:**
  - Coincident faces: 0.
  - Intersections: worst 0.0000.
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. There are 12 near-misses, all the existing arm-root/shaft clearances; none involves the sails.
  - Seams: 0.
- **Tests:** `movement-486` (9), `wind-rotor-working-interfaces` (8) and `camera-catalog` pass.
  - Tests 3–4 were rewritten for the hold, the 60° sector and the rest-to-rest C2 ends.
  - A new test sweeps 1440 poses and asserts that the board gap exceeds 0.45, that the length is 1.05 R, and that the plate pose holds.
- **Display profile (not edited, owned by p94-b-F5):** re-measuring 486 gives peak and peak-visible angular speed 8.8357 (was 16.983) and sustained 7.7620 (was 9.3346). The bounds are unchanged.
- **Residuals:**
  - The flip runs 30° later and 30° longer than the official animation's. It is recorded in the model's disclosures.
  - Brown's 60° board, drawn mid-turn, is shown radial, as before.
- **Proposed ledger row:** assessment reasonable, visibleFlaws "".
  - Limits, append: "p94: sails are Brown's 1.05 R; each is held edge-on from the top to 120° and flips over 120–180° (the official flip is 90–120°), which keeps neighbouring boards ≥ 0.51 apart; Brown's 60° board, drawn mid-turn, stays radial as in the official animation."

