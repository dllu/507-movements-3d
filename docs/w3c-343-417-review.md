# Pass-51 wave-3 lane w3c-343-417 review

I captured every ID before and after the changes with
`scripts/review-movement-source-views.mjs`, which composites the render beside
the plate, and compared the pairs by eye. Intersection figures come from
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

| ID | Change | Worst intersection before → after | Remaining |
| --- | --- | --- | --- |
| 343 | Camera lowered to (0.45, -0.7, 14) so the cylinder cover reads edge-on, like Brown's thin table | clear → clear | Flywheel arms are straight where Brown draws curved ones |
| 344 | None | clear | Cylinder is longer than drawn, because the official 2.25 crank is kept |
| 347 | Added Brown's bow joining two square collars on the rod ends (it rides with the disk and stays clear of the casing). Added the right-hand standard in section. Hid the base slab, the near pedestal and the casing pedestal. The shaft standards run off the plate. `hideGround` set | clear → clear | Crank plate is still a solid flywheel seen edgewise. Cut faces are dark, not hatched |
| 348 | None | clear | Rod B leans about 5° where Brown's leans about 1.5°. The official slot law fixes this lean at the plate's slot angle |
| 350 | Bar deepened to 0.40, near the lever's breadth. Guides a are narrow flanges with a front cheek, so the bar passes through a closed eye | clear → clear | Subject still sits left at t=0 |
| 351 | Rod widened to 0.62 away from its teeth. Broad collars. Head recentred. Unused rack teeth hidden. Rod shortened above the highest working tooth. C guides moved below the pinion and removed in presentation | clear → clear | Frame spans the full fall, so the subject is smaller than Brown's |
| 353 | Round-topped cam post and braces moved in front of the wiper wheel. Base block added under the post. Helve thinned to a plane in front of the wipers, so only the wear nose meets them | 0.077 → clear | Anvil is a free block |
| 355 | Pintle-bearing rim reduced to 0.155 / 0.04, inside the curved neck's sweep | 0.0325 → 0.0003 (seated journals) | Subject is small: the frame covers the whole precession sweep |
| 357 | Frame H starts at yaw 0, so wheel A is edge-on in the section plane, with pinion I on the left as drawn | 0.159 → 0.159 | Casing is an onion where Brown's is a broad scalloped bell. Wheel leans up-left where Brown's leans up-right. Lever N, swivel, rod C and Cardan pins lack bores |
| 358 | Removed the undrawn guide rail, its end ties and the travel ticks | clear → clear | The bearing frame is closed at the crank end because the crank would sweep through Brown's long rails |

For 361–417 the main changes are:

- 361: hooked strap lever (0.124 → clear).
- 362: straight groove, now flat-shaded.
- 366: feather key (0.023 → clear).
- 368: short shafts (0.077 → 0.0008, the marking point on its line, intended).
- 369: braced crossbar (0.204 → 0.026, the cord's own joints).
- 373: eyed hand and heaped load (0.070 → clear).
- 376: horse inside the lattice (0.057 → figure joints only).
- 377, 381: camera only.
- 378: kerf and carriage clearance (0.373 → 0.004, the seated rope).
- 382: mirror tilted as drawn.
- 387: bored and relocated pins (0.129 → intended waterline only).
- 389: rigid strap and removed bridges (0.056 → clear).
- 390: flat bands.
- 392: continuous leaf spring (0.129 → clear).
- 396: fork above the roller (0.080 → 0.071 pin/prong).
- 397: eyed crank plate.
- 400: spring anchor (0.119 → clear).
- 417: ball on rod B (rod/journal 0.063 remains).
