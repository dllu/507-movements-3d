# Pass 101 fix lane p101-f4

Reviewer: Claude Opus 5.5, lane p101-f4, 2026-09-28. This lane covers the medium audit findings 224, 246, 266, 271, 278, 343 and 350, plus the quick low findings in the files it owns. Movement 152 shares `authored-drawing-instruments.js` with 246, so its low was fixed too. Scratch files and captures are in `/dev/shm/p101/f4/NNN/`, outside Git:
- `before-tile.png` and `after-tile.png`: the plate plus 7 views (def, ph .33, ph .66, yaw ±50, back, top 70).
- `zz*.png`: aimed zooms.

Claimed files:
- `authored-expanding-pulleys.js`
- `authored-drawing-instruments.js` (not edited)
- `pantograph-working-parts.js`
- `trammel-ellipsograph.js`
- `authored-differential-screws.js`
- `differential-thread-solids.js`
- `authored-ratchet-bars.js` (not edited)
- `ratchet-bar-working-parts.js`
- `authored-safety-stops.js`
- `authored-upright-engine-parallel-motions.js`
- `authored-slotted-traverses.js`

The lows the brief names (281/284, 320, 323/328/330) live in files outside this lane: `authored-grooved-disk-followers.js`, `authored-saw-feeds.js`, `authored-maintaining-power.js`, `authored-parallel-rulers.js`, `authored-cartwright-parallel-motions.js` and `authored-forked-piston-guides.js`. They were not touched.

## 224: three tones for wheel c, the arms and the rim
- **Verified.** Wheel c, the six arms and the six rim segments were all driven blue (`315f78`).
- **Change.** Materials only. Wheel c stays blue. The arms are light steel (`9aa2a4`), distinct from the darker frame-grey guide rails. The rim segments are brass. Click e stays accent yellow and reads against the brass rim.
- **Captures:** `224/after-tile.png`, `224/zz.png`.
- **Validation report.** `docs/validation/219-224-414-contact.json` was regenerated with a scoped 224 rerun (17 poses). The results are byte-identical; only the source hash changed.
- **Tests:** movement-224 and variable-face-gear-solids pass.

## 246: B's floating cap, and C as one turned knob (low)
- **Cap.** The black cap of tracing point B floated 0.085 above the tracer shaft (y 0.885–0.935; the shaft top was at 0.80). In `pantograph-working-parts.js` it is now a solid cap seated on the hollow compound pin's top (y 0.755–0.805). The tracer shaft ends inside the cap.
- **C (low).** The foot disc, post, collar ring and cap were separate pieces. They are now one creased `LatheGeometry`: foot, cove, post, the collar the slide rides on, and a domed head. The round slide's side walls are closed arcs flush with its covers, so C reads as one knob with a rail slot.
- **Disputed (low).** The auditor said the bars should be broader. Measured on the plate, a bar is about 12 px wide over the 208 px B–U span, a ratio of 0.058; ours is 0.17/2.4 = 0.071. The model's bars are already slightly broader than Brown's, so they are unchanged.
- **Captures:** `246/zz.png` (B from the side and oblique; C from the side and oblique), `246/after-tile.png`.
- **Tests.** pantograph-working-parts now asserts that the cap sits on the pin top at 9 phases, that the shaft ends inside the cap, and that C is a single lathe mesh. The fixed-retainer audit uses the lathe. movement-246 passes (13 of 13 in total).

## 266: solid V-flanked threads
- **Verified.** The threads were square ribbons 0.055 deep on a 0.15 core, and half of each pitch was bare core, so they read as coil springs. Brown draws V threads whose plain middle rod is thinner than the thread root.
- **Change.** `differential-thread-solids.js` has a new closed trapezoid thread builder, `trapezoidThread`. It sweeps the same helix as 260's `helicalThread`. Each section is the trapezoid exactly clipped to the end planes: its radial extent shrinks where a flank leaves the slab, so the ends close without overlapping faces. The mesh is edge-manifold. Its inside test agrees with the analytic profile at 19,998 of 20,000 random points; the two misses are grazing rays.
- **Proportions.** The root is 0.8 pitch wide on a 0.12 core, and the crest is 0.2 pitch at 0.205. The pitches are unchanged: 0.3 coarse and 0.24 fine, same hand. The bearings carry the exact complement with 0.004 total axial clearance at every radius.
- **Low.** The moving standard's foot fillets were coplanar with the standard's faces (the screen found a flicker). They are now 0.001 inside those faces.
- **Validation report.** `docs/validation/260-266-275-thread-solids.json` was regenerated (33 poses). 266 has 0 penetrations, with working gaps of 0.0011–0.0013. The 260 and 275 rows are unchanged.
- **Captures:** `266/zz-before.png`, `266/zz-after.png`, `266/after-tile.png`.
- **Tests.** differential-thread-solids asserts that the complement holds at every radius, that the profile is V-flanked (root width more than twice the crest), and that the thread is at least 0.08 deep. movement-260, movement-266 and p98-handle-seating pass.

## 271: fulcrum standard and eye as one casting
- **Verified.** The grey boss sat on the square post, and their shared front face z-fought.
- **Change.** `ratchet-bar-working-parts.js` has a new `standardWithEye`: one outline in which the post (half-width 0.17, centred on the fulcrum pin) runs through 0.08 fillets tangent to a round eye (r 0.25), bored 0.134. It is extruded at the post's old depth. The separate bearing mesh is gone. The table still ends at the post's left face. The stationary shaft now fills the bore to 0.005 inside the back face, so the eye is not an open tube from behind.
- **Captures:** `271/zz.png` (front, oblique, behind), `271/after-tile.png`.
- **Screens.** The coincident-face screen is clear (it was the largest front-facing fight in the range).
- **Tests.** ratchet-bar-finite-contact now tests clearance to the post's left face (the eye is above the bar: rack top below y −0.25) and the bored-eye signed distance on the new mesh. movement-271 passes.

## 278: the broken rope hangs slack; bosses on the fulcrum bar
- **Rope.** The rope now parts just above the eye as the drop starts; before, the break lay far above the crop and the long lower piece stood upright. The break is driven by a new `ropeSlack`, which rises over the first 40% of the drop, is held through the arrest, and falls back through the reset.
  - The long upper piece hangs straight from the hoist and recoils up to 0.48.
  - The 1.45 lower stub goes from straight to limp (the points blend by arc length): up out of the thimble, curling over, and lying on B's head. It re-joins through the reset.
  - The stub's lay stays continuous with the upper piece.
  - While the rope is taut, one continuous piece runs from the hoist to the eye, and the stub is hidden.
- **Fulcrum pins (low).** The pins (r 0.13) straddled the 0.14-high pivot bar. The bar is now one extrusion with bosses (r 0.2) concentric with both pins and 0.06 tangent fillets.
- **Captures:** `278/strip.png` (phases 0, .12, .18, .22, .58, .60, .63, .66, .70, .90), `278/zb.png` (bosses from behind and in front), `278/after-tile.png`.
- **Tests.** movement-278 was updated: a taut rope has zero gap and a hidden stub; a fully slack stub lies inside the camera frame, with the upper end at least 1.4 above the eye (9 of 9 pass).
- **Loop seams.** The screen reports one intended mid-cycle "pop" at phase 0.563, when the continuous rope splits into the upper piece and the stub. The two coincide at that instant.
- **Residual.** The default (plate) pose is the arrested state, so it shows the parted rope lying on B where Brown draws stub a upright.

## 343: radius-rod pivots on lugs cast on the columns
- **Verified.** The grey drums lay on thin cantilevered shelves.
- **Change.** Each pivot is carried by one extrusion from the column's front face: a tab from the column's centre line running through tangent fillets (0.05) into a round eye (r 0.179) bored for the fixed shaft, from z −0.30 to 0.67. The shelf and drum are gone. The shaft ends 0.005 inside the lug's back face.
- **Captures:** `343/zz.png`, `343/after-tile.png`.
- **Tests.** beam-upright-solids passes: the bearing (now the lug) meets a column, clears the radius rod's layer, and the bores clear. movement-343 passes.

## 350: fixed pin O carried by a bracket on guide a
- **Disputed fix.** The auditor suggested carrying O on the broad standard. That standard is part of the traversing output bar, so O would move with it. It cannot carry the fixed pin.
- **Change.** O's black floating drum is replaced by one flat frame-grey bracket cast on guide a-2's upright:
  - a post continuing the upright up past the traversing bar;
  - a round-cornered arm across to O;
  - a bored boss concentric with O, joined by tangent fillets.
  
  It lies at z −0.50 to −0.12, between the moving standard (z ≤ −0.58) and the lever (z ≥ 0.21). Boss C's x range over the cycle is −0.83 to 0.83, and it stays below y 2.97, so the bracket never meets it.
- **Residual.** This is an undrawn support in the default view. Brown draws O as a bare pin. The rule allows a minimal support that explains a fixed pivot. If the user prefers Brown's bare pin (the 338 treatment), delete the bracket and keep O as a short pin.
- **Captures:** `350/zz.png`, `350/after-tile.png`.
- **Tests:** movement-350 and double-traverse-groove-solids pass.

## 152 (low): grooved cross as one extrusion with one floor
- **Change.** `trammel-ellipsograph.js` removes the separate walls, corner blocks, end caps, two groove floors and two base plates. The cross is now two pieces:
  - one slab from the paper to the floor (y 0.045–0.200), with the ink material on its caps so the exposed groove floor stays dark;
  - one wall extrusion: the union of the two arms less both slots, from y 0.199 to 0.42.
  
  The lip screen went from 1 to 0, and the step between the two floor levels is gone.
- **Captures:** `152/zz.png`, `152/after-tile.png`.
- **Validation report.** `docs/validation/152-assembly.json` was regenerated: 65 poses, 0 failing pairs, now 16 parts.
- **Tests:** trammel-ellipsograph passes.

## Screens (all eight IDs)
- **Disconnected parts:** 0 detached everywhere.
  - Remaining lips are pre-existing: 224 click pin (documented), 271 table/strap, 343 flywheel arms, 350 slot necks.
  - The new 278 "lip" is the bossed bar's bounding section against the leg, not a geometric lip: the bosses are 0.27 from the leg.
- **Coincident faces:** 0 flagged pairs for all eight after the 266 fillet fix.
- **Body intersections:** worst solid 0 for all eight. 152's 0.0687 coaxial is pre-existing.
- **Loop seams:** 0 seams, and one intended pop (278).
- **Tests.** authored-loader, camera-catalog, catalog and the targeted suites all pass. `tests/models.test.mjs` was run in full (see the final report).
