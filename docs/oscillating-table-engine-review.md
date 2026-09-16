# Oscillating and table engines: 344–346

Primary references: [344](https://507movements.com/mm_344.html), [345](https://507movements.com/mm_345.html), [346](https://507movements.com/mm_346.html). All three have official animations. Their captions, engravings and inline canvas constructions were reviewed.

## Retained motion

344 pivots the cylinder at its middle and joins the piston rod directly to the upper crank. 345 pivots the cylinder at its upper end and uses the lower crank. In each case, the cylinder and piston share the instantaneous trunnion-to-crank line; no artificial vertical guide is added. Their existing exact distance-based piston travel and derivative calculations remain unchanged.

346 retains the exact 2-unit crank and 11.125-unit side-rod construction, with a common vertically guided crosshead and a piston head 6.25 source units below it. Both parallel cranks remain in phase. The four-second cycles and source phase offsets are unchanged. These analytically determined mechanisms do not require contact simulation to solve their motion.

## Finite interfaces

344/345 previously used solid gland collars and rod-end covers overlapping the visible piston rod. Those parts now have finite passages aligned with the actual rod section and depth. Cylinder walls enclose the piston depth, while the face stays open to show the stroke. The piston crank eyes now have actual cylindrical bores and enough outer material to join the shank.

The previous continuous trunnion shaft crossed 344's working piston space. Both cylinders now use front/rear stub trunnions, with a front support bridge clear of the entire piston and its face indicator. The rear bearing is bored, and the front bearing sits ahead of the moving bridge. The crank arm, hub, disk and shaft now lie behind the swept piston rod rather than sharing its slab at some crank angles.

346's side rods formerly occupied their crank-arm layers and the table's depth. They now use the shared finite bored rods outside the table and their crank arms, with extended crank pins spanning the separation. The common crosshead fits between the straight guide rails and terminates before the side-rod eyes. The guide width was enlarged to fit the finite crosshead; this is an explicit three-dimensional clearance reconstruction rather than a literal trace of the canvas lines. The upper cylinder cover, gland collars and guide foot have actual piston-rod passages. Both crankshaft bearings have real bores.

The two owned modules share a small rectangular rod-passage geometry function. All three mechanisms use the existing piston-family camera fitting over the full stroke, a source-facing default view, and no fog or ground plane.

## Validation

`node --test tests/movement-344.test.mjs tests/movement-345.test.mjs tests/movement-346.test.mjs tests/oscillating-table-solids.test.mjs`

30 tests pass: 24 existing motion/rendering tests and six finite-interface checks. The new tests inspect rod passage cross-sections at 65 poses, check stub-trunnion and rear-crank axial clearances, raycast the real piston/side-rod eye bores, verify full pin engagement, and check crosshead containment and side-rod/table separation. The old 346 guide-center expectations were updated for the corrected opening.

Default/front browser captures and 17-pose projected-mesh checks reported no page errors. Maximum absolute screen coordinates were 0.863, 0.868 and 0.863 for 344–346. The final small crank-face depth adjustment removes the coplanar hub/disk artifact exposed by these captures while staying inside the tested rear-crank clearance.

## Limits

The open rectangular cylinder sections are explanatory cutaways, not pressure-tight castings. Rectangular rod passages suit the existing rectangular rod meshes; circular rods, seals, steam ports and valve timing are outside this pass. Bearing support details and crank hubs retain some simplified solid interfaces, and these tests are not a complete pairwise collision audit. The 346 guides are broader and its two rod planes farther apart than the flattened engraving; the altered depth is needed to expose both functional side rods and clear the table. No source silhouette tracing was needed to establish the corrected constraints.
