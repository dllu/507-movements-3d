# Movement 385: weighted door-closer joints

The [official caption and engraving](https://507movements.com/mm_385.html) describe two pins turning in sockets, a two-link toggle, and a hanging weight. They do not describe a spring. The current page contains an actual inline `ae.add_model("mm_385")` animation (verified 2026-09-16), an interpolated member, a connecting rod, and a 42-by-42 view. Its key phases are 0, 0.4, 0.5 and 0.9: opening, open dwell, closing and closed dwell. The initially disabled animation tab is enabled by JavaScript and is not evidence of unavailable animation. The reconstruction retains these normalized event proportions; the absolute ten-second duration, quintic easing and spatial door-hinge geometry are independently chosen.

## Correction

The old solid sockets overlapped the radius-0.085 rotating pins through 0.195 of their length. They now have closed through-bores of radius 0.089. The upper rotating pin carries a transverse clevis with two bored ears and a real radius-0.080 axle. The toggle axes are raised by 0.40 so the clevis bridges clear the socket lips; endpoint separation, link lengths and the engraving's rise-to-span proportion are unchanged.

Two rigid bored links replace the old solid endpoint spheres and overlapping link ends. Their eyes share the same transverse hinge axes but occupy layers at ±0.065, each 0.080 thick. The central weight-suspension link occupies the middle layer and clears both main links by 0.0075 axially. Retainers capture these eyes on a finite central pin. A second finite pin connects the suspension to the weight eye. The weight eye and neck have small axial offsets so the suspension can articulate without clipping them; the neck still joins the eye and body. Forks, retainers and these axial layers are inferred construction details that make the source's joint topology explicit.

The existing analytical door-circle and equal-link closure remain unchanged. The resulting height law and `-dU/dDoorAngle` gravity torque are still calculated. Closing speed, dwells and easing remain prescribed. No spring model, passive weight-swing solve, friction, impact, damping, strength or loaded closing-speed validation is claimed. The suspension is kept vertical and in the toggle plane; its finite clearances do not establish its unconstrained spatial dynamics.

The model retains geometry buffers during playback, disables ground/fog, uses full-cycle visible bounds and a more frontal camera, and requests a minimum ten-second display cycle. Root performs the integrated source/default/oblique browser review.

## Validation

```sh
node --test tests/movement-385.test.mjs tests/door-closer-working-solids.test.mjs
```

The eight existing law/source/render tests and six new finite tests cover socket bores, rotating pins, fork ears and bridges, both toggle links, the central axle/retainers, the suspension, and the adjacent weight eye/neck/body. Finite pair sweeps sample 97 poses through the complete cycle with a `2e-6` penetration tolerance. Separate axis checks verify that the actual link bores remain centered on their finite pins, rather than accepting remote clearance. Support-overlap checks ensure that fork bridges remain attached to the vertical pins and ears. Retained geometry, verified source event phases, inferred absolute timing and the public dynamics qualification are also checked.

This is a bounded working-joint review, not an exhaustive collision certificate. Architectural hinges and trim, remote frame contact, frictional load transfer, and unsampled geometric extrema remain outside these selected checks. Legacy tolerances for subtracting translated heights were relaxed only to `2e-15`, accommodating floating-point rounding after the pivot-height change.
