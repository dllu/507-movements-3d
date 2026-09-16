# Double-stroke slots, traverse and uniform groove: 348, 350, 354

Primary references: [348](https://507movements.com/mm_348.html), [350](https://507movements.com/mm_350.html), [354](https://507movements.com/mm_354.html). All three have official canvas animations; captions, engravings and inline constructions were reviewed.

## Motion choices

348 retains the source-derived exact two-slide/fixed-guide solution, including the rod's rocking and two reciprocations per disk revolution. The upper guide lies outside the engraving's crop and is an explicit inferred constraint.

350 retains the exact collinear slot geometry and reduced horizontal traverse. Its smoother transitions between the official four-second motion/dwell segments remain unchanged. The source site's note explicitly corrects Brown's interfering vertical riser; the offset riser remains part of this model.

354 retains the official 9.7-unit crank radius, 8.7-unit output half-stroke and eight-second physical crank period. Uniform speed on each half-stroke still entails instantaneous reversal: the existing velocity-jump and undefined reversal-acceleration metadata is preserved. This is an ideal kinematic demonstration, not a finite-force reversal claim.

## Finite corrections

348's two slides now occupy the disk-slot depth. The dark machined edges end at the central crossing and rotate around the proper axes; the former edge bars crossed the working opening. The disk slots have no inward bevel. The shaft ends behind the shoes and reaches the rear slot floors. Both rod pivots have actual holes through the shank and rounded cap. The inferred upper guide now fits its pin with running clearance, and the pin spans both guide and rod depth. The rear shaft bearing is bored, with its supporting bridge below the shaft rather than filling that bore.

350's output guide lips now capture the bar depth and clear its section; the rear guide uprights also clear the moving bar. Its input shoe runs between two rails instead of intersecting one central rail. The central output-bar/lever joint has a bore through every overlapping neck and boss, and a pin spanning both parts. The upper neck was shortened because it formerly refilled part of the upper slot and obstructed the fixed pin near mid-traverse.

354's former groove was a colored strip on a solid plate. The actual wrist envelope is now subtracted from the crosshead, including its two rounded reversal pockets. The stems and yoke share one continuous front layer clear of the disk, hub and shaft; their fixed guide cheeks occupy that same working depth. A raised retaining strap joins the groove's central island to the outer crosshead above the wrist cap. This is an explicit three-dimensional through-groove reconstruction; it avoids leaving an unsupported island while preserving the visible channel and exact motion law.

All three use sampled full-cycle camera bounds, a view near the source elevation, and no fog or ground plane. Shared finite plates and bored journals were reused; no contour tracing or physics baking was necessary.

## Validation

`node --test tests/movement-348.test.mjs tests/movement-350.test.mjs tests/movement-354.test.mjs tests/double-traverse-groove-solids.test.mjs`

28 tests pass: 23 existing kinematic/rendering tests and five finite-interface checks. They check 348's shoe section against actual slot walls/edges at 129 poses, rod pin bores and upper-guide engagement; all three 350 pin sections against the rendered necks/slots plus shoe/bar guide clearances; and 354's actual wrist section against the milled plate at 513 cycle samples plus both exact reversal instants. Retainer-post/cap clearance, strap height, stem continuity, guide depth and crank-layer separation are also checked.

Chrome default and front views were compared with all three engravings, with no browser errors. Seventeen sampled full-cycle poses fit the default viewport: maximum absolute projected coordinates were 0.883, 0.908 and 0.883 for 348, 350 and 354 respectively. Captures and the browser review report remain temporary artifacts outside Git.

## Remaining limits

348's external upper guide and support frame are inferred extensions beyond the source crop. The slide inspection faces remain explanatory parts ahead of the rod. 350 keeps smoothed timing rather than the canvas's abrupt changes of input velocity. 354's front-layer stems and raised island retainer are reconstruction choices; they are not detailed in Brown's flattened engraving. Its mathematically instantaneous reversal would require a different rounded law for finite-force dynamics. The tests qualify the corrected working interfaces, not every fastener, support contact or force path.
