# Feed-roll worm drives: shared-component pass

Source references: [195](https://507movements.com/mm_195.html) and
[207](https://507movements.com/mm_207.html), checked 2026-09-15. Both pages mark
“Animated” unavailable, so the engraving and caption are the motion reference.
195 places identical wheels on opposite sides of one worm. 207 places its wheels
on the same side of a common shaft; opposite worm hands preserve the opposite
wheel rotation and common direction of their facing surfaces.

This pass replaces the round-wire spring meshes in both movements with one
reusable `makeSolidWorm` component. It uses the existing straight-flanked worm
geometry and through-bore helper, supports both hands, and has integral roots,
flanks and end caps. The shaft bore has 0.001 model units of radial clearance.
195 needs a shallower root than standard proportions to fit its existing shaft;
this is a reconstruction assumption. The analytic pitch helix is retained only
as diagnostic reference data, not a rendered wire or a contact proof.

The existing continuous analytic 24:1 motion is retained: one input revolution
advances each wheel one tooth in opposite directions. No physics stepping or
collision-mesh generation is necessary for this ratio. Ground, fog and floating
pitch-contact dots are disabled. Wheel face rotation indicators remain useful.

## Validation and remaining work

`node --test tests/solid-worm.test.mjs tests/movement-195.test.mjs tests/movement-207.test.mjs`
passes 12 tests. Existing tests check continuous phases, finite-difference rates,
equal feed velocities and long sequences. New geometry tests raycast the actual
solid to check opposite helical hands, crest/root radii and an unobstructed bore.
Obsolete minimum-mesh-count assertions were replaced with solid-profile checks.

This is a component pass, **not complete finite-contact qualification**. The
current 195 face tooth spaces are still painted boxes, and 207 wheel teeth are
skewed trapezoids rather than a worm-generated enveloping surface. These need a
shared face-wheel / generated-wheel follow-up; analytic pitch equality cannot
prove their visible flanks clear the worm. Existing invented bearing frames,
solid wheel hubs and source framing also await the family review. The original
source does not determine pressure angle, depth or shaft clearance; the worm
uses a conventional 20-degree axial pressure angle. Browser screenshots are
integration review, not evidence of conjugate working surfaces.

## Next shared correction batch

Start with 207's two ordinary worm wheels. Reuse
`generateWormWheelProfile` from `worm-wheel-profile.js` offline, supplying the
same worm dimensions and axial phase convention as `makeSolidWorm`. Render the
baked radial field with `makeInstancedWormWheel` from
`instanced-worm-wheel.js`: it stores one closed, bored tooth sector and instances
it around the wheel, avoiding duplicated dense buffers. One generated field
should serve the two equal wheels after a handedness reflection and phase
adjustment; qualify that mapping against both visible worms. Keep its pure ratio
animation. Do not call the profile generator on a browser cache miss.

195 is a related but separate face-tooth adaptation. Its smooth rear faces and
opposed working faces should remain. `face-gear-geometry.js` provides a useful
periodic face-height-grid and backing-disk construction, but its current cutter
is an involute spur pinion, **not a worm**. Reuse its mesh representation while
replacing the cutter sweep with the actual solid worm. One baked face-tooth
sector can then populate both identical wheels, reversing the working-face
orientation. This replaces the painted slots without tracing individual teeth.
The face-wheel and ordinary radial-wheel envelopes must not be treated as
interchangeable.

`spiral-wheel-geometry.js` is for a round face-thread cutter and is not a direct
replacement for either of these straight-flanked worm drives. Movement 202's
globoidal worm similarly belongs to a later envelope variant, rather than a
blind cylindrical-worm substitution. Validate each envelope once over a tooth
period and reuse its result in equal copies; keep full source reconstruction as
a later pass. The current helper construction measured roughly 49 ms for 195
and 42 ms for 207 in one local Node run (18,781 and 21,346 total triangles);
these are diagnostic timings, not browser-performance guarantees.
