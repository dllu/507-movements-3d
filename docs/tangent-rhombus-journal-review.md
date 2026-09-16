# Tangent rod, rhombus and sliding journal: 268, 273, 279

Primary references: [268](https://507movements.com/mm_268.html), [273](https://507movements.com/mm_273.html), [279](https://507movements.com/mm_279.html). All three provide official animations. Captions, engravings and inline animation constructions were reviewed together.

## Retained motion

268 retains its exact upper tangent between the finite-width rod and the fixed roller, including analytic derivatives and the existing no-slip roller rotation. The dimensions are an independent idealization of the engraving; the canvas uses somewhat different crank/roller proportions.

273 already had real bored links and exact equal-link rhombus closure. Its sinusoidal eight-second demonstration remains unchanged. The official animation uses a wider stroke and short dwells at reversal; that difference remains explicitly recorded in the source metadata.

279 retains its exact Scotch-yoke laws: crank x drives the crosshead and crank y locates the upright sliding box inside the slot. Its four-second cycle and selected crank direction are demonstrations rather than a frame-for-frame copy of the official canvas. No new physics solver is needed for these determined geometric constraints.

## Finite corrections

268's former solid shank and cosmetic eye occupied the crank pin. The new finite rod and wear strip are cut through at that pin, and its eye and roller have real bores. The roller is centered on the rod's working depth instead of overlapping only a thin edge. The crank arm and shaft are behind the entire swept rod layer. The analytic tangent and running radii are unchanged.

273's split guides now have front and rear retaining straps, giving each guide a closed aperture in depth while clearing both the rod and its larger translation index. Existing finite link and slider eyes were reused unchanged.

279's continuous output bar previously filled its own slot. It is now two arms joined by the yoke, leaving the wrist/box path open. The finite box sits within the guide faces rather than mostly ahead of them. Its gibs have a 0.018-model-unit running gap; the slot-face and gib solids now agree with that reported clearance, without inward bevels. The split lining pieces have circular wrist faces and matching straight outer tapers against their gibs, replacing unsupported half-rings floating between the gibs.

The adjuster shafts/threads fit the declared box envelope throughout the cycle. Fixed rod guides clear the output arms, and their depth reaches the guide posts. The rear crank hub clears the moving yoke and runs through a real bearing bore. The wrist and its face are shortened to the actual box depth instead of projecting far ahead of it.

All three use full-cycle camera bounds, a view near the source elevation, and no fog or ground plane. In 279 this also removes the former deliberate cropping of the output tails.

## Validation

`node --test tests/movement-268.test.mjs tests/movement-273.test.mjs tests/movement-279.test.mjs tests/tangent-rhombus-journal-solids.test.mjs`

28 tests pass: 24 existing analytic/rendering tests and four new finite-interface checks. The new checks raycast actual rod/roller bores, verify full-depth roller engagement, check all four closed guide apertures against the largest rod section, sweep the complete journal-box envelope and output-guide clearances, and inspect matching liner/gib taper boundaries and wrist clearance. Legacy mesh-count and gib-clearance expectations were updated for the corrected geometry.

Default/front browser captures and 17-pose projected-mesh checks reported no page errors. Maximum absolute screen coordinates were 0.867, 0.878 and 0.906 for 268, 273 and 279, inside the viewport throughout each cycle.

## Remaining limits

268 imposes the selected tangent and no-slip rolling kinematically; separation, friction limits and force balance are not dynamically validated. 273's timing differs from the official animation as described above. 279's screws depict static wear adjustment; screw-driven wedge travel, preload, wear and bearing forces are not simulated. Other fixed-support details remain schematic, including the added display posts/base in 279. These checks qualify the corrected working interfaces rather than every mesh pair. No decorative contour tracing was required.
