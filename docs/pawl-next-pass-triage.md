# Next reusable pawl corrections: 225, 235 and 236

Read-only triage on 2026-09-16 found three bounded candidates for the same
finite-contact and stepped-pawl components used in 271 and 284. No correction
to these three movements is claimed by this report.

The measurements below describe baseline commit `bec462f`. Run
`node scripts/screen-pawl-working-interfaces.mjs` to measure the current model;
after corrections it should no longer reproduce those baseline defects.
The fortieth pass records the corrections in the
[225](carrier-pawl-225-contact-review.md),
[235](star-tappet-235-review.md) and
[236](alternating-pawl-236-contact-review.md) reviews.

| Movement | Measured defect | Reusable correction |
| --- | --- | --- |
| 225 | Claimed driving contact has a radial normal: maximum absolute moment arm `1.28e-15`. It cannot transmit the prescribed wheel torque through frictionless compression. | Place the finite nose on a real working flank and solve the hinged-pawl closure, as in 284; retain the source's separate carrier and pawl pivots. |
| 235 | Both tappet and holding noses start at world Z `0.18`; the wheel ends at `0.15`. The entire supposed working interface is separated by `0.03`. | Step the finite noses into the wheel plane, keep their backing bodies clear, and verify drive, return and rollback against the actual star faces. |
| 236 | The long and short contact fingers start at Z `0.21` and `0.33`; the wheel ends at `0.15`. Their depth gaps are `0.06` and `0.18`. | Reuse stepped hooks/bored hinges, then qualify both working flanks and the alternating handoff; simply extending the fingers may reveal previously hidden XY interference. |

The Z ranges above are from the actual transformed mesh bounding boxes. A
65-pose sweep of mesh vertices, edge midpoints and triangle centers against
the wheel triangles independently reproduces the gaps: `0.0300000` for each
235 nose, and `0.059999998`/`0.179999998` for 236. This is a defect screen,
not exhaustive collision certification. Movement 225 has no sampled nose
penetration (`+0.0000189` minimum clearance); that does not remedy its zero
compressive torque. Its moment was calculated from the public driving contact
point and the normal toward the rounded nose center.

The [225](https://507movements.com/mm_225.html),
[235](https://507movements.com/mm_235.html) and
[236](https://507movements.com/mm_236.html) pages fetched on this date have
no canvas, `add_model` registration or `mm_present` program. The initial
animation-tab CSS was not used to decide availability. Use their engraving
and caption as the source, and identify inferred return bias/holding separately.

The existing point-law tests should be retained where applicable, but revised
contact checks must establish finite overlap, proximity, useful normal and
continuous release/re-engagement. Matching two prescribed marker coordinates
cannot establish a mechanical transmission. Bake expensive contact work
offline; reserve native dynamics for passive branch or load-transfer uncertainty.
