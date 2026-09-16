# Marine and beam parallel-motion pass: 332–336

Primary references: [332](https://507movements.com/mm_332.html), [333](https://507movements.com/mm_333.html), [334](https://507movements.com/mm_334.html), [335](https://507movements.com/mm_335.html), [336](https://507movements.com/mm_336.html). All five have official animations and existing construction metadata.

## Motion review

332, 333, 335 and 336 already solve their rigid-bar circle intersections and derivatives rather than stretching members to force a straight piston path. Their small departures from exact straight-line motion are intentional and correct for the modeled dimensions. Existing metadata records the official animations' rounded-dimension closure discrepancies. Those better analytic constraints and four-second cycles were retained.

The reference site expressly calls 333's added piston rods explanatory and its interpretation of 335 uncertain. The models retain those disclosures. This pass does not establish that either inferred application is historically definitive.

## Shared finite-part corrections

A single reusable `bored-link-rod.js` now supplies the rigid rods in 332, 333, 335 and 336, including optional intermediate pin stations. The former solid shanks, solid bosses and decorative eye rings physically filled the locations occupied by their pins. Each new rod is one finite plate with actual holes; intermediate bosses are part of that plate and cannot refill the holes. Fixed radius-bar shafts in 332, 333 and 335 were extended to reach the full depth of the moving eyes.

All five mechanisms now disable fog/ground and use a view close to the source elevation. Camera bounds cover the sampled full stroke rather than relying on oversized manually entered bounds.

## 334: rack, sector and backing roller

The former straight-sided sector teeth overlapped the rack teeth: a 65-pose planar audit found up to **0.0001150894 square model units** of overlap before the correction, even before considering bevels. The existing rack flanks are approximately 20-degree pressure-angle flanks. The sector now uses matching 20-degree involutes, its existing 180-tooth equivalent pitch and tip/root radii, and a small working backlash. Intrusive tooth bevels were removed from both sides.

Across 97 poses the corrected extruded tooth sections have **zero detected overlap**, and the greatest distance to the nearest rack flank is **0.000393927 model units**. This checks that the correction does not simply move the teeth apart. The backing roller now has an axle bore. Its rack wear strip previously projected beyond the declared contact line into the roller; its outside face now lies on that tangent line.

## Validation and limits

`node --test tests/movement-332.test.mjs tests/movement-333.test.mjs tests/movement-334.test.mjs tests/movement-335.test.mjs tests/movement-336.test.mjs tests/marine-parallel-solids.test.mjs`

The existing 40 tests retain dense kinematic closure, rates, straightness-error and periodicity checks. Six new tests inspect rendered pin cross-sections at 33 poses, stationary shaft engagement, the 97-pose tooth mesh, the roller bore and wear-strip tangency.

Desktop default/front captures and 17-pose projected-mesh checks had no page errors. Maximum absolute screen coordinates were 0.890, 0.838, 0.860, 0.873 and 0.818 for 332 through 336 respectively, inside the viewport.

These are bounded corrections, not an all-mesh or complete source-fit qualification. Other beam, crosshead and bearing interfaces still contain legacy solid-joint approximations. 334's articulated chain remains a kinematic construction, without a tension/contact simulation. The 332/333/336 explanatory pistons and frames differ from the engraving. 333 starts at the opposite stroke endpoint from the engraving, and 335's inferred fixed-radius-bar layout differs visibly from the drawing. Those source-fit items remain open for a later pass; manual contour tracing would not resolve the ambiguous topology.
