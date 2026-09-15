# Movement 143: sliding worm carriage review in progress

The [source caption and engraving](https://507movements.com/mm_143.html)
describe a worm keyed to a rotating shaft, sliding with the carriage that
also carries the worm wheel. A rod connects the wheel wrist to the fixed
right post. The source page marks its animation unavailable (checked
2026-09-14).

The existing analytic rod closure is suitable for this prescribed mechanism;
live browser physics is unnecessary for the linkage. This review has corrected
two finite assembly defects in the authored model:

- The carriage front plate occupied z = −0.51 … −0.31 while the guide occupied
  −0.73 … −0.47, producing 0.04 units of interference. Its new interval is
  −0.44 … −0.24, leaving 0.03 units of running clearance.
- The fixed rod pin started at z = −0.27, separated from its supporting post's
  front face at −0.49 by 0.22 units. The pin now spans −0.52 … 0.62, seating
  in the post and reaching through the front pivot eye.

`tests/sliding-worm-clearance.test.mjs` checks the actual mesh bounds of the
axis-aligned carriage plates against the guide over 721 positions, guide
coverage, and the pin's seating and front reach. Both tests failed before the
repair and pass afterward. The existing movement 143 analytic linkage test
also passes. These checks cover those interfaces, not the entire assembly.

The production build and packaged desktop/mobile playback check pass. The
legacy model now exposes Restart, using the engine's existing analytic
time-zero reset; its paused canvas exactly matches the initial image after
restart. The browser check also covers orbit interaction and no WASM requests.
Desktop, oblique and mobile screenshots were inspected. Private build and
screenshots remain outside Git.

The worm remains a tubular helix driving a scripted wheel. Its reported mesh
phase and pitch velocity agreement follow the imposed ratio and do not prove
finite tooth contact or clearance. Tooth geometry, shaft/hub bores, the
remaining supports, and source proportions still need review before 143 can
be considered verified. Do not use the legacy contact metadata as evidence
that this is a contact-solved or MuJoCo-validated worm pair.

## Finite tooth review

`scripts/review-sliding-worm-contact.mjs` tests actual tube vertices, edge
midpoints and triangle centers against the wheel triangles, over 129 offset
poses spanning a full wheel revolution. The current runtime pair interferes
at every pose: 282,146 sampled points lie inside the wheel, reaching 0.071924
world units (4.795 engraving pixels). See
[legacy contact evidence](validation/143-legacy-contact.json).

The lower exposed wheel arc was scanned independently from the raster.
Its dominant tested integer harmonic is 22 teeth, with 21 close behind;
this supports retaining 22 as a regularization of the uneven drawing.
Its outside ink radius is roughly 56–58 pixels, rather than the runtime
model's 60-pixel nominal outside radius. The replacement candidate uses a
56-pixel nominal outside radius, 51.33-pixel pitch radius and the existing
65.25-pixel shaft spacing. See
[measurement](validation/143-wheel-measurement.json) and
[radius overlay](validation/143-wheel-overlay.svg). The scan covers an
exposed lower arc, not the obscured complete perimeter.

`scripts/prototype-sliding-worm.mjs` reuses the project's axial trapezoidal
worm and generated throated wheel. It writes a private profile to
`/dev/shm/143-worm-candidate-profile.json`; the candidate is not yet installed
in the application. Its working flanks replace the legacy wire coil. Actual
shaft/key bores, source phase, supporting hardware and complete assembly
validation remain required before integration.

The generated silhouette is fitted over the exposed lower arc by
`scripts/fit-sliding-worm-phase.mjs`. The fitted phase and a one-pixel ink
allowance give a 4.015-pixel radial RMS error; this is a limited arc fit,
not a claim of whole-model superposition. The
[generated silhouette overlay](validation/143-generated-overlay.svg) was
inspected against the whole wheel. Standard 20-degree flanks, one start,
the reconstructed 0.3-unit wheel width and hidden depths remain assumptions.

The candidate **does not pass contact acceptance**. Across 33 offset input
poses, bidirectional surface samples find one penetration of 0.00001225
units. More importantly, exact working-flank triangle distances detect
intersection at three poses, including two missed by those point samples.
The largest finite normal-force power residual is 26.0%. Rows with zero gap
have no usable force direction; their torque/residual and the aggregate
sentinel values are serialized as `null`, not as passing zeros. See
[candidate contact evidence](validation/143-generated-contact.json).
Refine and recheck the actual surfaces before using them in the application;
do not merely relax the point-containment threshold. The earlier 0.0004
clearance candidate also had two sampled penetrations; increasing clearance
to 0.0006 alone did not resolve the exact contact check.
