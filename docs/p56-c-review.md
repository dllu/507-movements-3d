# Pass 56, lane c (movements 255–381)

Findings come from `/dev/shm/audit56/c/findings.json`. As the brief says, when the default view crops a whole part, that alone is not a flaw. The exceptions were 327–329 (frame the cylinder and flywheel) and 335/337/338 (the tiny floating anchor stubs).

The ledger's open items for 270 and 318 are also covered here. For every change I checked captures in the default view plus oblique, ±60° rotated, back and top views, at several phases. Scratch material is in `/dev/shm/m56c`.

The intersection screen is `node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Per movement

| ID | Change | Screen after |
|---|---|---|
| 262/263 | Added a tail standard (a copy of E) with a plain bush on screw D beyond the nut, so B is an overhung body on two bearings. Roller C's short axle is now carried by an arm to a sleeve on a round guide post behind B, clear of B's largest swept radius. In 262's end view the tail standard sits exactly behind E. The spring or weight that presses C onto the cone is still not drawn. | Only the cone/roller working contact (0.0000). |
| 270 | The lower return sheaves' fixed journal now runs back into a plain floor standard with a foot, behind the rope plane. It is below the plate's crop and only seen when the view is turned. | Coaxial 0.0001 sheave web/journal, unchanged from before. |
| 271 | The hairline cord is replaced by one continuous laid rope (radius 0.035). It runs from the bar end over the pulley down to a hanging cast weight with an eye. The weight lowers by the bar's travel. The pulley axle is carried by a strap from the table end. The fit box is extended so the weight is framed. | Weight eye and rope tie (seat 0.0148). The rope rests on the bar end (0.0000). |
| 272 | Restored the undrawn frame (base rail, posts, shaft bearings, backing rail and brackets), which is no longer presented away. Added one upright from the base to the guide backing rail. Post tops were lowered to the bearing underside because they used to pass through the shaft (0.078 → clear). | Clear. |
| 278 | Posts A stand on a plain floor sill that ties their feet. | Only the known leaf-spring self pairs and the seated pawl/tooth contact. |
| 279 | The guide lips were black and their faces were flush with the slot sides, so they z-fought into a cross-hatch. They are now in the yoke's own colour. | Clear. |
| 284 | The right post rises to the underside of the carriage slide. The slide's depth was cut so it clears the pinion (0.05 → clear). | These coaxial joint pairs remain but were not touched by this pass: bell-crank arm/catch/hinge, knob/fulcrum and rod pins (0.02–0.127). They are probably older than this pass; not confirmed. |
| 314 | The loose rear post is replaced by a flat L-shaped front cock. It carries the lever's front journal and runs out to the right, clear of the tail, then down to the right banking pin's head. The right pin was lengthened to meet it. | Clear. |
| 318 | The balance spring is now one continuous swept ribbon, collet to stud R. The segment meshes stay only as hidden curb-pin interface proxies. The inner coils are heavier (0.032, Brown's bold spiral), easing to 0.014 at the collet and on the terminal coil between the curb pins. | Spring/collet seat 0.009, same as before. |
| 327 | The view frames the whole flywheel and the whole cylinder. The guide columns run down to a plain bed plate that the cylinder stands on. | Only the roller tread contact. |
| 328 | The view frames the whole flywheel and cylinder. Added a base plate under the cylinder, two standards carrying the upper bed's ends, and a hanger from the bed whose bore takes the flywheel shaft's front end (the shaft was lengthened into it). | Clear. |
| 329 | The view frames the whole flywheel, the A-frame and the cylinder. The A-frame legs continue on their line to a bed plate under the cylinder base. | Clear. |
| 335/337/338 | Radius pin F's wall flange now sits on top of a plain column standing on the floor at the cylinder's foot level. A new helper, `flangeColumn`, was added to `beyond-crop-hardware.js`. I first tried a tie bar from O to F, but it read as an extra link in the default view and I rejected it. | Clear. |
| 347 | The disk, its peripheral seal and the slot lips are clipped by a world clipping plane on the same z = 0 half-section as the chamber. The disk now reads as Brown's section line and never hangs outside the housing. The ball, rods and bow stay whole. | Clear (the seal mesh is listed as open, as before). |
| 354 | Restored the rear frame rails, guide brackets and input bearing that `source-presentation` had removed. The guides are now held by a frame. | Touch only (0.0000), as before. |
| 358 | The fixed cord anchors now sit 3.2 beyond the stroke ends instead of 7.5. At each end of the traverse the near anchor stand comes up at the edge of the carriage-following view. The test for this was rewritten to match (see Tests). | The screen runs out of memory, even when I temporarily restored the anchor margin to 7.5. So the OOM predates this change and is not caused by it. |
| 364 | The painted rim ticks (`engraved-panel-line-between-oblique-grooves`) are removed through `source-presentation`. | Clear. |
| 367 | The scale's graduations are now narrow grooves cut into the top layer of a cream ivory strip; the painted black tick bars are hidden and kept only as calibration references. Brown's text says the ivory scale is real, so the strip stays. | A through-pin × brass arc pair at 0.0798 appears in the screen. The pins and arc were not touched, so it is probably older; not confirmed. |
| 368 | The spiral is a real rounded helical groove (0.028 deep, 0.09 wide) cut into the cylinder surface along the scribed helix. The painted tube is hidden. The marking point runs 0.022 into the groove. I regenerated `docs/validation/368-372-contact-solids.json` (33 poses); only the source hashes changed. | Clear. |
| 373 | The floating ceiling plate and hanger are replaced by a floor standard, bearing and foot behind the belt, all beyond the crop. | Clear (the tether mesh is open, as before). |
| 378 | The log lies back so the saw's cut is 0.22 from its near end. The kerf half-width goes from 0.07 to 0.10, so the slot reads from the sides and top. The log now rests on two hollowed sleepers on a ground plank. | Only rope/anchor deformation contacts (0.0017). The 10 GB heap is needed only for this screen. |

## Ignored as pure crop

Pure default-view cropping of whole parts was ignored, as instructed, for 277, 283, 286, 292, 293, 295, 299, 307, 310, 311, 330, 333, 336, 340 and 348. The same applies to the crop remarks in 347 (left post), 354 (stem), 368 (rack) and 373 (belt).

## Remaining limits

- **262 end view:** it now shows C's guide post and arm beside B.
- **270:** the upper stationary journals still have no carrier; Brown's open section is kept.
- **272, 354:** show a plain frame the plate does not draw.
- **Undrawn supports added elsewhere:** 327–329 now show bed plates and standards the plates don't draw, and 335/337/338 show a floor column.
- **358:**
  - At mid-stroke both anchors are necessarily far away, because the cord's free length equals the stroke.
  - The cords stay 0.018 in radius, because two cords share one groove.
- **318:** the spiral's heavier inner section is a drawing choice; a real hairspring has a uniform section.

## Tests

The following pass:
- `movement-{262,263,270,271,272,278,279,284,314,318,327,328,329,335,337,338,347,354,358,364,367,368,373,378}`
- `bearing-working-solids`, `cam-272-276-solids`, `cord-traverse-working-solids`, `cone-friction-solids`
- `detached-chronometer-working`, `double-traverse-groove-solids`, `marine-parallel-solids`
- `piston-guide-solids`, `piston-guide-329-331-solids`, `release-mechanism-working-parts`, `ratchet-bar-finite-contact`
- `roller-indexer-finite-envelope`, `ruler-349-367-solids`, `saw-feed-working-parts`, `scriber-dynamometer-solids`
- `roller-working-solids`, `spring-pivot-family-solids`, `tangent-rhombus-journal-solids`, `vibrating-direct-action-solids`
- `watch-balance-interfaces`, `source-presentation`

`models.test.mjs` has one failure, "movement 32 … tangent without slip", which belongs to another lane and not to this pass.

These tests were updated to match the intended changes:
- `movement-272` (bearings present, mesh count)
- `movement-328` and `piston-guide-solids` (the 328 view frames the whole cylinder)
- `movement-337/338` (the flange column is allowed)
- `cord-traverse-working-solids` (the 358 anchor reaches the view edge instead of staying outside)
