# Chain pump and self-acting weir: 462–463

Sources: [462 chain pump](https://507movements.com/mm_462.html) and [463 weir](https://507movements.com/mm_463.html), original captions and engravings. Both official pages mark the animation unavailable. No 2D motion oracle is supplied.

## Corrections

462 keeps the exact continuous arc-length path and equal wheel rates. Actual bored hubs and bearings replace intersecting solid cylinders. Thin split wheel cheeks clear the transverse sealing disks. Their pockets are cut offline from the carrier cross-shaft sweep through both straight/arc transitions; the carrier shafts also fit inside the riser bore. The riser is a finite annular wall, its intake sits above the lower wheel envelope, and the outlet trough has a real passage for disks. The inferred reservoir level remains above the intake. Hidden foundation/reservoir boxes no longer dominate framing. Minimum playback cycle: 8 seconds.

463 preserves its analytic lower-leaf angle, solved from the upper edge/lower face constraint. Both finite panels and bearing supports have actual pivot bores. Reinforcement strips lie on the free panel sides; the gold contact strip stays inside the solved panel envelope. A rear cantilever support exposes the lower leaf. The ordinary overflow stream clears the notch and is shown only while closed; the bed stream fits below the actual lower-panel corner. Separated head volumes are schematic level indicators rather than water intersecting the moving gates. Minimum playback cycle: 12 seconds.

Both models disable material fog and the ground plane. No dynamic force solve is claimed.

## Reproduction and evidence

```sh
node scripts/generate-chain-pump-pins.mjs
node --test tests/chain-weir-interfaces.test.mjs tests/movement-462.test.mjs tests/movement-463.test.mjs
```

Run from the repository root after installing its locked npm dependencies. The deterministic generator uses the analytic 0.62-radius, 24-carrier path, all carrier positions, both wheels and 1,025 equally spaced input phases over a full turn. Circular 0.044-radius cutters sweep around the 0.04-radius shafts. Polygon coordinates are rounded to 1e-9 for robust clipping. The resulting approximately 69 KB JavaScript module is loaded directly; no envelope generation runs in the browser. Factory constants are explicitly checked by the contact regression.

25 tests pass. Across 65 full-cycle poses offset from the generator sample grid, selected rendered-surface checks evaluate 57,696,600 chain-pump and 536,400 weir point/solid pairs, with penetration tolerance 1e-5. Cross-shaft samples include the actual cheek depth planes, not only shaft endcaps. Covered pairs include shaft/hub/bearing bores, carrier shaft/wheel pockets, disks/wheels/riser/flanges/trough, shafts/riser, wheels/riser, weir pivots/panels, panel contact and visible flow streams. Geometry identities remain stable through updates.

Working pocket-to-shaft proximity is checked independently over both wheel wraps: sampled nearest gap 0.00386435 model units. This is a geometric clearance, **not loaded force contact or proof of drive torque**. The prescribed chain path retains exact continuous position/tangent and wheel-rate tests. Local CPU observations were 175 ms construction / 0.095 ms update for 462 and 37 ms / 0.009 ms for 463; these are machine-specific measurements.

Final serialized Chrome source/default/front/open review showed no errors or clipping. Maximum full-cycle screen extent was 0.862 for 462 and 0.797 for 463. Rendered geometry including shadows: 118,252 triangles / 231 calls, and 10,656 triangles / 45 calls. Current screenshots show the shortened riser and the unobstructed lower weir leaf. Bulk images and logs remain under `/dev/shm/chain-weir-*`.

A separate regeneration into RAM took 39.8 seconds and was byte-identical to the checked-in profile module (SHA-256 `3587b0b122d02cfb9440736e65ed3bc548313686dada147fd0742d625b68e3c3`).

## Remaining limits

462's visible continuous chain is not a rigid articulated link system: chordal action, joint forces, tension, slack, bearing friction and drive torque remain unsolved. Split-cheek pockets and narrow cross shafts are inferred construction details. The source does not specify their exact geometry. The 0.015 disk/riser radial clearance is a display clearance, not a leak-tight seal. Water remains schematic; pressure, priming, leakage and efficiency are not validated. Foundation and reservoir context are omitted from the working view.

463's upper angle and water levels remain scheduled demonstrations. The geometric lower-leaf closure does not establish that hydrostatic pressure will produce the shown opening/reclosure, or that the mechanism is stable. Fluid pressure, inertia, impact, friction, seal leakage and sediment transport remain unvalidated. Head volumes are deliberately separated from the gates; opening flow is schematic. Cantilever bearing supports and the small bed clearance are inferred, rather than pressure-tight construction details. Native dynamics would be a separate bounded investigation of these unresolved forces, not evidence supplied by this pass.
