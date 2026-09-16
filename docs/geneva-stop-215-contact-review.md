# Movement 215: finite mouth handoff

Movement 215 now uses a compatible relieved mouth and reconstructed output branch. The former `0.029991` pin/mouth collision is removed; the interior straight load faces, five locking pockets and convex terminal sector remain. Movements 212 and 213 are unchanged in this follow-up. The separate [earlier review](geneva-stop-working-surfaces-review.md) records 212's unresolved broad-finger law.

The [official 215 page](https://507movements.com/mm_215.html) has an inline animation. Its crescent/pin construction and interior radial-slot law remain the reference. Its nominal instantaneous entry/exit schedule cannot fit the finite rounded mouths. The source oracle is retained as `sourceKinematics`; the runtime explicitly identifies its reconstructed handoffs. The initial view retains the registered animation phase, which differs from the engraving phase.

The offline generator sweeps the finite pin through each inactive mouth and subtracts only that envelope. It then solves the lowest nonpenetrating output angle against the retained pin face. The crescent holds the wheel until pickup; the pin drives the actual mouth, joins the original interior law, and remains in contact slightly beyond the old nominal exit. The final settling angle is at most `0.000033` radians and reaches the exact dwell datum within the declared `0.000022` crescent-profile tolerance. Monotone cubic interpolation supplies continuous angle and velocity at the joins. Runtime performs no polygon clipping or contact search and retains all geometry buffers.

This is a geometrically qualified branch with an imposed positive output-contact bias. Forward motion assumes resisting output torque; reverse playback needs assisting preload to follow the same face. Impact, friction, inertia and spring forces are not solved. The tiny final lock settling is a tolerance-based reconstruction, not a native force simulation. The viewer discloses these limitations.

Rebuild the approximately 250 KB geometry/branch asset with:

```sh
node scripts/generate-geneva-stop-215-contact.mjs
```

A second generation is byte-identical: 5,557 exterior points, 249,738 bytes,
SHA-256 `9e16f67fd28a08263e457b5cfebf51bf116d133236feb9753c60d2bc731deabc`.

Focused validation:

```sh
node --test tests/movement-212.test.mjs tests/movement-215.test.mjs tests/geneva-stop-working-solids.test.mjs tests/geneva-stop-215-contact.test.mjs
```

All **21 tests pass**. The existing finite suite now includes mouth handoff poses without its old exclusion. New checks cover every reachable mouth, finite pin and extruded wheel witnesses, actual crescent surfaces, both terminal stops, 8,193 increasing-input states, repeated reverse playback, matching exposed speed/contact fields and retained buffers. Measured witnesses:

- Pin/profile gap: `−2.13e−7` to `+2.04e−7` model units across sampled loaded handoffs.
- Minimum positive output moment arm of the compressive pin normal: `2.4283` model units.
- Maximum actual 256-sided pin surface gap at a contact witness: `0.00001319`.
- Worst sampled crescent/wheel chord overlap: `0.00001775`; largest distance to either handoff load surface: `0.00001755`. Both are below the declared `0.000022` profile tolerance.
- The old collision witness now has `+0.0000441` signed clearance.

This is selected-interface evidence, not exhaustive contact or passive-load certification. Root's final source/default/oblique browser review reported no errors or clipping, maximum NDC `0.77315926`, 58 draw calls and 81,812 shadow triangles. Terminal markers remain on the unchanged cusp/sector contacts. Framing, playback duration, supports and terminal limits retain the previous correction.

The final production build passes in 21.54 seconds, the 215 construction/update
screen has no flags, and both 215 and unchanged 212 pass the packaged
desktop/playback/mobile checks in 11.0 seconds.
