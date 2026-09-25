# Pass 55 lane p55-geo-a review

Lane scope: supports for floating parts and shape/artefact fixes for 72, 123, 144, 150,
152, 154, 165, 167, 171, 172, 173, 180, 186, 197, 210, 219, 225, 236, 238, 240, 241, 244,
260, 266, 269, 275, 280, 284, 286, 299, 305, 307, 313, 318, 323, 326, 327, 328, 344, 348,
376 and 378 (findings in `/dev/shm/audit55/{a,b,c}/findings.json`). Reviewer: Claude
Opus 5.5 (lane p55-geo-a), 2026-09-25. Nothing was committed.

Method: each ID was captured in the production loader (`async-engine` + `model-loader`,
own vite server on port 44434) at the default view and several rotated views and phases,
before and after each change. Intersection screens use
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`, or 0.02/65 where the
0.01 run ran out of memory. **The screen builds the registry (authored) model.** For IDs
that `model-loader.js` routes to a baked or wrapper factory (150, 152, 154, 165, 167,
173, 180) the screen does not see the production geometry, so those rows keep their
previous intersection evidence. The support parts added there were placed by coordinate
checks against the moving parts' sampled bounds.

## Per movement

| ID | Change | Screen (before → after) | Proposed ledger text |
|---|---|---|---|
| 72 | The workpiece contour kept Brown's zig-zag break line, which extruded into stepped slabs. `finishedWorkpiece()` now drops the break-line vertices, so the tail ends in a plain cut face. | clear → clear | Workpiece is one whole bar with a plain end. No remaining visible flaw from this finding. |
| 123 | No production change. Production is `baked/sector-handoff.js` (centre spur z 0..0.2, rack 0.32..0.46), so the gear is not coplanar with the rack. The dark "dashes" are the centre spur seen, in the rack's shadow, through the gaps of the rack's right-hand teeth; the same dashes appear in the audit capture and the current one. A trial edit to the unused authored rack was reverted. | unchanged | Residual: behind the rack, the same-coloured centre gear shows through the rack tooth gaps as a column of dark dashes. This is not a z-fight (the gear is 0.12 behind the rack). A colour or depth change would need a rebake. |
| 144 | The foot under the post (previously the post's own footprint) is now a plain foot plate 3.4× the post's width at Brown's ground line. | only invisible-envelope `fluid` rows | Post stands on a foot plate. |
| 150 | A minimal guide was added for the valve slide: two guide bars on a flat bracket behind the rod, strapped up to a standoff on the lever's fixed fulcrum. The source-presentation `remove` pattern no longer strips `output-guide-*`. | production not screened (wrapper); bracket is behind the rod plane (z .62–.68 local) and clear of the lever and cams in x/y | Slide runs between guide bars on a bracket from the fulcrum. Limit: the guide and bracket are reconstructions that Brown does not draw. |
| 152 | Brown's ellipse is now a thin flat ink line lying on a paper-coloured drawing board under the instrument. A solid base under the grooved cross-piece rests on the board. | production not screened | Ellipse is a pencil line on paper; the cross-piece rests on the board. |
| 154 | A plain rear post rises from the ground block to a bored head round the top pulley's axle stub, behind the hanging weight. | production (baked) not screened; post at z −0.42..−0.24 is clear of the weight (z ≥ 0.22) and the cord | Top pulley is carried by a rear post. Limit: the post shows in the default view (Brown draws no support). |
| 165 | A guide box was added round the upright output bar below the lever, with a flat bracket behind the moving parts. The bracket also carries a standoff under the fulcrum pin. | production (baked) not screened; bracket z 2.40–2.52 is behind all moving parts (≥ 2.66) and outside the cam radius | Output bar guided; fulcrum supported. |
| 167 | A fixed bearing frame was added: bored arms at both drum ends, a long rod guide bush on the upper arm (above the stud seat's highest point), and a back rail behind the drum. | production not screened; bush y 1.85–2.40 is above the seat's maximum (1.736), and the rod is present there at all phases | Drum and rod are carried by a simple frame. |
| 171 | A foot bar now runs under both slide-guide columns, and a flat bracket sits behind the trunnion shaft. | 0.0281 (pre-existing rod-pin/die-rod pair) → 0.0281 | Guide rods and trunnion stand on a foot. Remaining (not in this lane's list): the valve-rod upper guide block still hangs. |
| 172 | A slim back bar runs from the crank-shaft end to an open ring under the guide frame, which stands on two posts at its closed end. (The first version had two more posts at the open end; the rod hit them, 0.070, so they were removed.) | – → clear (after removing the open-end posts) | Frame and shaft carried by a back bar. Limit: in the default view the back bar reads as a thin line behind the rod. |
| 173 | The black stripes painted on both star-wheel cheeks were removed, and the ink-coloured index tooth was reverted to wheel colour. | production (baked) not screened; paint only | Plain star wheel. |
| 180 | The side-piece screw shanks were trimmed to end inside the side piece, and the pivot bolt to end just past its back washer (visual only). | production (baked) not screened; shortening only | No shanks poke out. The side piece shows its screw bores from behind. |
| 186 | No change. The loop's return leg crosses 0.49 behind the descending band (closest centreline approach 0.016–0.03 in x/y at 0.488 z separation, 4 phases). This is Brown's crossing, not a self-intersection. | clear | Reword the finding: the loop passes behind itself as Brown draws it. |
| 197 | The end-guide mounting post now sits within the frame's end member (0.11 wide) and the front bar ends at its outer face, so nothing pokes out past the frame ends. | clear → clear | No stray bars. |
| 210 | A slim strap behind the bar joins both guide blocks and a bored boss round the input shaft's rear end. | clear → 0.0001 coaxial (shaft running in the boss) | Guide blocks and shaft carried. Limit: the strap shows as a grey band either side of the bar. |
| 219 | The generated long fluted spur (the cutter that formed the crown teeth) is now shown as the pinion, replacing the lantern-stave wire cage. | clear → clear | Solid long fluted pinion as drawn. Pinion shaft bearing is still not drawn. |
| 225 | The return stroke is now solved so the pawl nose rides the wheel outline, 0.003 clear at mid-stroke and exactly 0 at both ends, dropping into each gap. Previously a fixed 0.25 rad sin² lift held it a tooth height off. Angular speed is taken by central difference. | clear → clear | Pawl drags back over the teeth. |
| 236 | The contact toes are now pawl-coloured (integral cranked noses). The pawl planes moved from z 0.47/0.59 to 0.30/0.42, so the toes jut 0.17 less. | clear → clear | Short cranked toes, no black cross-pins. |
| 238 | The anchor body is thickened back to the wheel's rear plane (z −0.11..0.26), with a pad under each working face and wider straps. B and C now rise out of the anchor, and C reads as the hooked arm end. | 0 (B working contact) → 0 (same) | Pallets are part of the anchor. |
| 240 | The spring pawl's round-wire cable was replaced by a flat rectangular leaf (`makeDynamicLeafSpring`, 0.104 wide in the plate plane, 0.07 thick). Its end is trimmed at the attachment pin, and its plane moved 0.11 forward to clear the stop's pivot ring. | first leaf version: deforming 0.070 (pin) / 0.034 (pivot ring) → clear | Flat leaf spring. Limit: at 0.104 wide it is still slender compared with Brown's broad leaf. |
| 241 | The driving tooth's trailing side was broadened into a tapered horn. The working edge and tip are unchanged. | 0 working contacts → same | Broad tapered tooth. The click still pivots on a bare stub (not in this lane's list). |
| 244 | The C/C′ stop standard is carried down to a plain foot below the scale pan. The scale ring now hangs on a pin in a lug under the beam end. | only the zero-depth brake-block/drum contact | Stops and ring supported. Limit: the standard and foot extend the default view downward. |
| 260 | The white radial index stripes that the gear helper paints on F, B, D and E are hidden. The thread audit was regenerated (33 poses, 0 penetrations). | clear | Plain gear faces. |
| 266 | Shaft core 0.102 → 0.15, so the square thread is 0.055 deep and reads as a solid screw. The bearings are unbevelled, and both uprights are flush and equal in section with their bearings (no seam). Thread audit regenerated (0 penetrations). | clear | Solid threaded screw, seamless uprights. |
| 269 | The stroke now spans only the two middle rack groups plus 0.6 pitch into each end group (12.2 pitches around a shifted centre; was 17). The closed end moved out to clear the gear tips by 0.05 at the stroke limit, so the gear never leaves the rack at the open end or enters the crossbar. The rack relief was rebaked and `tests/movement-269.test.mjs` updated. | clear → clear | Always meshed and clear. Limit: the outer three teeth of the upper-left group and the last lower-right tooth are drawn but never engaged; the frame is 1.7 pitches longer than Brown's. |
| 275 | The worm thread now ends in full-section radial faces inside its span (new `squareEnds` option in `helicalThread`), replacing the knife-thin run-out wedges. Thread audit: 0 penetrations. | clear | Square thread ends. |
| 280 | A solid round knee at the hand-lever bend fills the open mitre. | only the zero-depth rim/flange seats | One bent lever. |
| 284 | The two floating dark rods were replaced by one top-rail strip seated on the bed, in the bed's colour. | no pair involves the rail; the pre-existing coaxial pin-joint rows are unchanged | No floating rods. |
| 286 | The accent tube along the toe edge is hidden, and the lifter shoe is now the lifter's colour and flush with its faces. | zero-depth toe/shoe and seat contacts | No stripe strips. |
| 299 | The striping was faceted per-strip normals, not shadow acne: it persisted with shadow receiving switched off. The raked tooth backs and rake faces now have smooth analytic normals. A tighter shadow map with normal bias was also added. | zero-depth tooth/pallet contacts | Smooth tooth faces. |
| 305 | **Attempted and reverted.** Pin radius 0.024 → 0.09 opened Brown's rectangular throat, but with the 1/60-eccentricity orbit (0.075) the pin then met the upright impulse faces at their corners (finite face gap 0.018, `pin-escapement-working-solids` failed). No change remains. | unchanged | Residual (unchanged): the stepped notch, the tiny ruby "speck" and the plain disc remain. The fix needs Brown's larger eccentricity (~0.25) and a reworked impulse and face law. |
| 307 | A fixed suspension pin now passes through the pendulum's top eye, with a retaining head in front and a small cock behind. | zero-depth working contacts only | Pendulum hangs on a pin. |
| 313 | The torus "pipe" that looped round stone T is now a solid round boss joining detent and stone. | clear | No knot. Remaining: the detent keeps its outward bow (to clear the tooth tips) and the banking heel peg. |
| 318 | The fixed and regulator rings were shrunk to Brown's small ring round the staff (r 0.28/0.40, was 0.62/0.76), so the spring shows as one spiral from the collet to stud R. The active/inactive colour coding was removed. The scale arcs and ticks are hidden (plain silvered sector). | spring/collet seat 0.009 (unchanged) | One visible spiral, plain scale. |
| 323 | No change. The apertures are open through-slots (the wheels pass down to the paper); the pixels inside equal the page background. Restoring the paper sheet made the default view a grey sheet and the lit slot floor still brighter, so it was reverted. | unchanged | Residual: the open slots show the page background. |
| 326 | The camera fit now also includes the whole flywheel rim. | zero-depth shoe contacts | Flywheel whole in view. |
| 327 | Guide straps A lengthened (lower end one source unit lower), so the rollers stay on them at the bottom of the stroke. Cylinder, cover and gland lowered 0.35, so the crosshead stops clear above the cover. Default crop extended 0.35 down. | zero-depth roller/strap contact | Rollers stay on A; crosshead clears the cover. The flywheel stays cropped in the default view as Brown draws it. |
| 328 | No change. Verified that pinion pitch radius 0.42 + wheel C pitch radius 1.05 = centre distance 1.47, in the same plane (z .37–.65). The mesh sits behind the bed in the front view. | unchanged | Meshes; hidden behind the bed. |
| 344 (345) | The crank pin's rear end now stops 0.02 inside the rear crank web, instead of lying coplanar with its back face. | clear | No z-fight. |
| 348 | The slot floors are shown in the disk's own material, 0.01 let into the walls, so the cross slots read as grooves. | clear | Plain slot bottoms. Bar B still runs off the top of the canvas. |
| 376 | Only the camera-side frame is removed now. The rear bearing, arm, standard and base rail stay behind the wheel, so the axle is carried. All standards moved 0.16 outward, clear of the riveted rim band. | rivet/rim vs standard 0.060 → clear | Axle carried by a rear standard. Limit: that standard is visible through the lattice. |
| 378 | No change needed. A kerf (z .27–.41, floor 0.28 above the log axis) already exists, and the screen (0.02/65) shows no saw/log pair. | clear | Blade runs in its kerf. |

## Tests

These suites pass: tilt-hammer, bored-scissor-link, selectable-cam-valve, trammel-ellipsograph,
weighted-bell-crank-baked, wave-cam-baked/contact, reversing-groove-drum, movement-172,
173-assembly, single-clamp-baked, movement-180, 186, 197, 210, 219, 225, 236, 238, 240, 241,
244, 260, 266, 269, 275, 280, 284, 286, 299, 305, 307, 313, 318, 323, 326, 327, 328, 344,
345, 348, 376 and 378. Also passing: seven-tooth-238-contact/working-parts, clamp-working-solids,
variable-face-gear-solids, differential-thread-solids, friction-family-working-solids,
saw-feed-working-parts, cam-281-286-solids, pin-escapement-working-solids,
three-leg-dead-rest, chronometer-return-contact, free-escapement-solids,
watch-balance-interfaces, oscillating-table-solids, double-traverse-groove-solids,
treadwheel-working-solids, source-presentation and mujoco-screw.

Test edits:
- `movement-225`: the return-clearance expectation is now the riding pawl, 0.002–0.0035 (was > 0.45).
- `movement-269`: the new stroke and layout geometry, and tips clear of the closed end.
- `movement-376`: the rear frame is kept and the front frame removed.

`tests/models.test.mjs` passed in full (163 tests) before the final 240 and 376 depth tweaks. Those two movements' own suites were rerun afterwards and pass.

Regenerated: `docs/validation/260-266-275-thread-solids.json` (33 poses, 0 penetrations) and the
baked 269 rack relief in `authored-mutilated-racks.js`.
