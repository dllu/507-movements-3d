# Movement 225: finite carrier-pawl contact

The [official caption and engraving](https://507movements.com/mm_225.html) show a floor-pivoted vibrating carrier supporting a separately hinged pawl, which intermittently advances the ratchet. The page contains no registered `ae.add_model` or `mm_present` animation. The engraving therefore supplies the topology and proportions; no official motion oracle is available.

The previous nose position was close to the rendered wheel, but its claimed driving normal was radial: the measured moment arm was at most 1.28e-15. Proximity alone did not establish useful drive contact.

## Correction

The unchanged 0.09-radius nose now follows an offset of the actual rising tooth flank. The hinge closure determines the carrier swing and wheel phase together. The existing 20 teeth, wheel radii, 2.64 pawl length, floor pivot and carrier length remain; the full carrier swing is 6.344 degrees and each cycle advances exactly one tooth. The reconstructed pawl retains the engraving's curved body and separate hinge.

A 0.0002 running clearance separates the finite nose and working flank. The real mesh face normal has a positive output moment arm of 1.400286 throughout the drive. The rounded nose still overlaps the wheel axially by 0.14; it was not moved out of the working plane.

Applying the new flank seat to the previous return schedule exposed approximately 0.01479 penetration at the next crest. A prescribed sine-squared lift over the return half-cycle now delays the drop sufficiently to clear that crest and reaches the next seat with continuous position and velocity. This changes the return schedule, rather than removing useful tooth geometry.

The curved pawl body and floor bearing use explicit ordered perimeters and hole rings. A first implementation passed Node tests but failed polygon-clipping ring reconstruction in Chrome when unioning tangent capsule arcs; those runtime unions have been removed. A focused check now verifies the simple curved perimeter, continuous finite body and retained bore.

The pawl and carrier now have separate bored eyes around a common finite shaft. The floor bearing is bored, and the wheel hub and fixed output journal have actual shaft openings. The curved pawl body clears the wheel face by 0.025, and its plate clears the carrier plate by 0.095. The source-facing camera bounds are retained. Ground and fog are disabled, and the minimum displayed cycle is four seconds.

## Validation

`node --test tests/movement-225.test.mjs tests/carrier-pawl-225-contact.test.mjs` passes **12 checks** (six existing movement regressions and six finite-interface checks).

- Actual rendered driving triangles have the expected normal, positive output moment and zero prescribed relative normal velocity at 33 drive poses.
- The full circular nose versus the complete rendered tooth outline has minimum clearance **0.0001999925** over 1,025 poses; the existing 32,769-state motion check also passes.
- Rendered nose/wheel surface checks at 65 poses preserve working depth overlap and a drive gap below 0.00024.
- Bored hinge and floor interfaces clear their shafts by more than 0.0038; the output hub clears its shaft by more than 0.0029. Hinge centers remain coaxial.
- Full-cycle visible vertices fit the existing bounds. Repeated state queries and updates preserve object and geometry identities.

## Remaining assumptions

This is a finite geometric contact reconstruction with prescribed motion, not a passive load simulation. The small running gap is explicit; separated meshes do not themselves exert forces. Pawl return bias and wheel holding during return are imposed. Gravity or a spring must supply the appropriate pawl bias: at the drive start the normal reaction's moment about the pawl hinge is approximately -0.17051 per unit force, so a positive output moment does not establish passive pawl stability. No extra holding pawl has been invented where the engraving does not show one.

Friction, impact, inertia, compliance, holding torque and load capacity remain unvalidated. Return velocity is continuous; acceleration need not be continuous at the phase boundaries. MuJoCo was not needed to determine the corrected geometry, and no dynamics claim is made. The viewer reconstruction note exposes these prescribed-motion assumptions.

The final wheel index is flush inside the root disk. Root's final default/oblique views show no errors or clipping (NDC 0.78434), and the final build and packaged desktop/playback/mobile case pass.
