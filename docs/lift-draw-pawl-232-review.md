# Movement 232: short drawing tip and rocking carrier

The former `0.1300` drawing-pawl/wheel penetration is closed. C now has the source's outer body and a short rounded inward tip. Only that tip enters the tooth plane; it bears on the actual radial tooth flank during the draw. The previous retaining-click, bored-joint and wheel-index corrections remain.

The [official caption and engraving](https://507movements.com/mm_232.html) describe lifting C out of the teeth, carrying it backward, then dropping and drawing on lowering B. The fetched page has no canvas, inline animation program or `ae.add_model` registration; no official animation is available. A is journalled at the wheel axis in the drawing, and the caption does not call it fixed. We explicitly reconstruct it as a bounded rocking carrier, with the right-hand holes interpreted as curved guide passages. This is an inference, not a claimed source dimension or demonstrated passive mechanism.

The earlier fixed-A model forced rigid C to retrace its outbound path while the wheel stayed still, then asserted contact with a new tooth on return. Its long generated inward surface crossed the wheel. Carving that surface clear also removed its supposed load face; that approach was rejected.

The new two-degree-of-freedom branch preserves the parallelogram exactly. Two-link inverse geometry determines A and B from the short tip's position:

1. Lift the tip radially clear of the tooth crest.
2. Carry it backward one tooth pitch with `0.04` radial clearance.
3. Drop into the next gap while B begins lowering.
4. Hold on the tooth flank while the retaining click lifts.
5. Draw one tooth clockwise on the finite radial flank.
6. Hold the wheel while the retaining click reseats.

During draw, output angle follows the tip's angular bearing and the selected radial flank. Its compressive contact has a clockwise moment arm of `1.82` model units. A and B rotate together during this interval; the carrier follows a different path during lift and drop. All stage joins have continuous position, velocity and acceleration. The output angle is unbounded across cycles, so its marker does not reset.

C's front body has real pin bores and a short axle connecting its bored working roller into the tooth plane. The rocking carrier has a bored central journal and finite curved passages around both fixed guide pins. A separate fixed brace supports the retaining-click and guide pins. The upper pivot pin now ends ahead of the wheel rather than crossing its teeth. Playback takes six seconds per cycle, retains geometry buffers and disables ground/fog.

## Qualification

Carrier lift/drop and click transfer are **prescribed**. A bounded MuJoCo trial with an actuated B, passive rocking A, trial relative spring and passive retaining click jammed instead of establishing the desired branch. Across three six-second cycles it stopped near wheel angle `+0.054276` radians, with maximum penetration `0.002050` and parallelogram joint error `0.008381` radians. This failed diagnostic was rejected; it supplies no playback data or passive-force claim.

Reproduce the diagnostic with:

```sh
node scripts/study-rocking-pawl-232.mjs
```

It writes only to `/dev/shm`. The trial uses inferred masses/springs, frictionless rounded contacts and a cylindrical approximation of the root disk. Further passive validation would require suitable preload, stops and transfer forces; no additional spring tuning was attempted in this bounded pass. Loads, impact and friction remain unqualified. The viewer states these limitations and identifies the inferred carrier freedom.

```sh
node --test tests/movement-232.test.mjs tests/lift-draw-pawl-232-solids.test.mjs
```

All **13 tests pass**. Eight source/kinematic checks cover the stage sequence, inverse linkage closure, radial-flank output constraint, analytic derivatives, transfer timing, rendered state and twenty-cycle marked closure. Five finite/presentation checks cover:

- Actual main tip, axle, C body and retaining parts against the wheel through 193 poses over two cycles: minimum sampled signed clearance `+0.00000970`.
- Actual draw witnesses over 65 poses: maximum surface distance `0.00001787`, below the `0.000021` circular-mesh tolerance, and nonzero clockwise contact torque.
- Retaining contact and actual blocked rollback.
- Twenty selected body, bore, shaft and guide-slot interfaces over 33 poses.
- Continuous click derivatives, exposed contact fields and retained buffers.

These are selected-interface checks, not exhaustive collision or loaded-dynamics certification. Root's final source/default/oblique browser review found no errors or clipping (maximum NDC `0.90040`). Its CPU screen reported approximately 338 ms construction, 0.043 ms update P95, 18,636 triangles and no growth flags. Geometry and law are frozen for integration.

The final production build and packaged desktop/playback/mobile case pass,
including a repeat after the final metadata correction.
