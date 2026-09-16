# Movement 236: alternating pawls

The [official caption and engraving](https://507movements.com/mm_236.html) show one vibrating lever, two independently hinged pawls, and nearly continuous ratchet motion. The page was checked directly: its unavailable marker is present and no inline animation is registered. The engraving's wheel arrow indicates counterclockwise motion. No 2D oracle is claimed.

## Mechanical correction

The former toes floated 0.06 and 0.18 ahead of the wheel. Their nominal contacts were on the long descending tooth ramps: the real inward face normals produced clockwise moments, despite metadata using the pawl's rod direction to report a positive moment.

Both rounded toes now reach 0.23 into the actual wheel depth and seat at the convex outer corner of the steep rising flank. The wheel retains all fifteen original asymmetric teeth and both working faces. The chosen normal is 10 degrees clockwise of radial, lies inside the cone of the two actual corner face normals, and gives **+0.281310** counterclockwise moment per unit normal force on both strokes. The finite 192-sided toe differs from its enclosing analytic circle by at most **0.00000603** at contact.

The fixed engraving pivots and lever outline remain. Equal-length endpoint constraints solve an inferred lever swing of **14.962981 degrees**, advancing one tooth per half-stroke. The long toe's source-pose position changes from the traced interior-ramp location to the mechanically compatible outer corner, about 0.318 model units away (20 source pixels). Wheel angle remains unbounded, with continuous contact handoffs and zero speed only at the two lever reversals. A smooth 0.15-radian outward return term, with zero value and derivative at both ends, prevents the returning toe from crossing the tooth before reseating.

Pawl eyes and the lever web now have actual through-bores and finite pivot pins. The lever is axially separated from the independently swinging eye collars; the fixed pivot shaft reaches the lever. The output hub fits its shaft. The wheel index is a thin flush patch wholly inside the root disk. Full-stroke bounds include the returning pawls and handle, the default view is nearly front-facing and opens at a handoff with both pawls seated, fog/ground are disabled, and display timing has a six-second minimum cycle. Playback retains geometry buffers.

## Evidence and limits

`node --test tests/movement-236.test.mjs tests/alternating-pawl-236-contact.test.mjs` runs **13 checks**. The existing dense state checks cover 32,768 return samples, exact pitch advance, monotone output and analytical velocities. Dedicated checks inspect actual triangle normals at 65 poses, enclosing nose circles against float32 tooth edges over two cycles, actual finite toe/body/eye surfaces through 65 poses, pivot passages through 17 poses, repeated handoff continuity, full-stroke bounds and retained buffers. Minimum enclosing-circle clearance is −2.83e−8 (float32 rounding); minimum sampled finite-surface separation is +0.000002265. These are selected working-interface checks, not an exhaustive all-pairs certification.

**The corner seating and pawl return bias are prescribed.** A freely hinged two-force pawl is not proven to maintain this chosen corner normal under load: hinge bias, contact force balance, impacts and load capacity require a separate dynamic qualification. The viewer says this explicitly. The finite geometry and continuous drive branch are qualified; passive force closure is not. MuJoCo was not used because this pass fixes the determinate geometric incompatibility without claiming passive stability.

Root's final default/oblique views show no errors or clipping (NDC 0.86085), and the final build and packaged desktop/playback/mobile case pass. Opening at the seated handoff tilts the lever relative to the engraving; the flat-lever reference remains separately recorded. The source fit around the inferred corner seat remains approximate.
