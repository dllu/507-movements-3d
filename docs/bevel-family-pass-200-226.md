# Bevel family pass: 200 and 226

Reviewed against the original engravings and captions on [200](https://507movements.com/mm_200.html) and [226](https://507movements.com/mm_226.html), 2026-09-15. Both already use the shared conical back-cone involute approximation. This pass preserves that geometry and the determinate analytical transmission rather than adding live physics.

## Corrections

- **200:** removed the invented rectangular rear frame and bearings absent from the engraving; shifted the input shaft's inner end from x = 0.10 to 0.14, clearing the stationary spindle of radius 0.115. The default camera now approaches the source's near-front projection. The two rigid driving sections remain the existing reconstruction of the broad source driving wheel.
- **226:** corrected the input assembly pivot: it previously rotated around the world origin and visibly orbited B away from its two mating gears. It now spins about its own fixed right-stage shaft. The full transverse planet axle crossed the uninterrupted F shaft. Replaced it with a blind journal starting at z = 0.13, bored the planet hub to radius 0.078 around its 0.066-radius pin, and added an inferred outside cantilever to support it. Shortened input B so its inner end also stops 0.13 from F's axis. Both journal starts clear F's 0.078 radius by 0.052 model units. The cantilever rotates with the carrier and lies outside the gears' radial/axial envelopes. This support is an explicit reconstruction of hardware hidden by the plate.
- Both models hide the ground and floating nominal contact spheres, disable material fog, and retain face rotation indicators. Playback remains roughly 5.8 seconds per input turn for 200 and 6 seconds for 226, whose output turns three times faster.

## Evidence and limits

`node --test tests/movement-200.test.mjs tests/movement-226.test.mjs tests/bevel-family-assembly.test.mjs` passes 14 tests. Existing sweeps verify 32,769 analytical mesh states per movement; the new regression checks actual journal bounds, the planet's mesh bore vertices, and journal clearance through a carrier revolution, and the actual world-space position of B throughout its revolution. These tests qualify the corrected hardware and kinematic relationships, not complete finite tooth contact.

The source describes two output turns for 226. Its equal-gear constraints instead give C = +B, carrier A = F = −B, and C + E = 2A, hence E = −3B. That existing discrepancy remains documented in model metadata. Both official pages mark their animations unavailable. The compound driving wheel of 200, the hidden support/joinery of 226, exact tooth contact, and full source-superposition remain reconstruction/review residuals. Browser reviews of the default, front, and quarter-cycle views confirmed the corrected B pivot and clear ground; screenshots are temporary `/dev/shm/200-bevel-*.png` and `/dev/shm/226-bevel-*.png`. No MuJoCo validation is claimed.
