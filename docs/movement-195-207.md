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

The initial solid-worm pass did **not complete finite-contact qualification**.
195 face tooth spaces remain painted boxes. The 207 trapezoids noted in that
pass have since been replaced and sampled against the worm triangles; see the
generated-wheel correction below. Analytic pitch equality alone cannot prove
that visible flanks clear the worm. Existing invented bearing frames,
solid wheel hubs and source framing also await the family review. The original
source does not determine pressure angle, depth or shaft clearance; the worm
uses a conventional 20-degree axial pressure angle. Browser screenshots are
integration review, not evidence of conjugate working surfaces.

## Shared correction approach

The implemented 207 correction starts with its two ordinary worm wheels. Reuse
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

## 207 generated-wheel correction (2026-09-15)

207 now replaces its skewed trapezoids and solid root disks with a baked,
worm-generated radial envelope. Each wheel instances one closed, bored tooth
sector 24 times. `scripts/generate-feed-worm-wheel.mjs` generates the 128 × 16
field in about 3 seconds offline; browser construction reads the baked field.
The generator's optional root and tip parameters match `makeSolidWorm` exactly:
24 teeth, pitch radius 1, worm pitch radius 25.5/86, three turns, wheel depth
0.38 and 20-degree axial pressure angle. The legacy generator defaults are
unchanged. A 0.0065 radial cutter allowance (0.559 engraving pixels) accommodates
sampled and triangulated flanks. This leaves intentional clearance rather than
claiming perfect zero-backlash engagement. The 24:1 motion and 2.62-second input
revolution remain analytic and continuous.

The generating convention puts its worm above the wheel. Rotating the generated
pair about X puts it below; reflecting the pair across X produces the other
worm hand. Both wheel rotor phases are now -pi/2 instead of centering the old
trapezoid gap. Their phase mapping was checked against the **actual visible
worm and wheel triangles**, not only the pitch helix.

`node scripts/review-feed-worm-solids.mjs` checks both directions of every
working pair at 65 poses over one input revolution. The published report
`docs/validation/207-worm-solids.json` records 4,559,672 vertex, edge-midpoint
and face-center queries, with no sampled penetrations over 1e-6 model units.
Minimum sampled positive gap is about 0.0002286. A deliberately incorrect
0.06-radian wheel phase produced 38,294 penetration samples per hand at three
poses, confirming the audit rejects incorrect assembly phases. Distances in
that negative control are capped at 0.01; its reported depth is a lower bound.
Ten focused geometry/movement tests pass, including preserved generator
defaults, matching cutter dimensions, both hands and open wheel bores.

This qualifies the sampled working-flank geometry only, not continuous collision
freedom or dynamically determined backlash. Frame/shaft/hub clearance and full
source framing still await review. The wheel hubs remain solid; the generated
wheel body itself has a genuine bore. 195's face-wheel adaptation remains
separate work, as described above. Nominal source root/tip metadata still
records the original source construction circles; the generated field determines
the actual tooth radii (approximately 1.4 source pixels smaller at the tips).

Browser review of the default, front and advanced phases found no missing or
inverted faces; both worm hands and counterrotation render correctly. The first
dense field drew about 1.83 million triangles including shadows. The final field
reduces the two visible wheel surfaces to 250,272 triangles, about four times
fewer, with its own repeated finite-mesh qualification. Final default/front/
advanced captures also pass without browser errors; the renderer reports
538,964 triangles including shadows and 78 draw calls. Narrower 0.003 and 0.005
allowances on the coarse grid failed the audit and were not published. The
invented lower support frame and protruding output shafts remain source-fit
residuals.
