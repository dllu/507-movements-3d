# 254: source-proportioned fork sprocket

[Brown's caption and engraving](https://507movements.com/mm_254.html) show the
wheel in edge elevation and identify it as a chain sprocket. The official page
has no animation. Neither a chain shape nor its route is supplied, so this
review corrects the depicted wheel without inventing a chain installation.

The old shaft was 7.6 model units long, versus approximately 4.24 implied by its
width relative to the drum's diameter. It is now 4.25; its radius and hub size
also follow those broad source proportions. Fork prongs were nearly twice the
depicted width. Their center spread is now ±0.27 with radius 0.065. Equal angular
spacing, rounded solid branches and the inferred ten-fork count are retained.
These regular shapes use analytical components, not pixel tracing.

The drum and hub reuse the common bored lathe geometry, with a 0.005 radial
shaft fit allowance and ideal rigid fastening. Fork roots have finite overlap
inside the drum. The former floating shaft indicator is a small flush face
mark. Redundant coincident rim tubes are hidden to remove edge speckles.
The default camera now shows the source's edge elevation with little perspective
distortion; its bounds include every visible part throughout a turn. Fog and
ground are disabled, and the display retains a readable five-second revolution.

The former gap estimate subtracted the round prong radius horizontally from
its centerline. A sloping cylinder occupies more horizontal width. The corrected
seat half-gap is `x_center − radius * sqrt(1 + slope²)`, about 0.103 model units
at the retained nominal seat radius. Actual triangle-distance checks confirm
the gauge boundary clears both finite prongs and a wider gauge intersects.
This is a cross-section fit check, **not** a validated chain engagement law.
Nominal pitch advance remains an inferred geometric relationship; articulation,
entry/exit, chain loading and friction are not simulated.

Validation: all 12 checks in `tests/movement-254.test.mjs` and
`tests/sprocket-finite-parts.test.mjs` pass. They cover source ratios, the actual
prong surfaces, shaft bores, fork attachments, full-cycle bounds, stable geometry,
and existing rigid rotation/pitch bookkeeping. The source/default/oblique browser
review has no errors or clipping (maximum NDC 0.846). Bulk captures remain in
`/dev/shm/sprocket32-final-254-{default,oblique}.png`.
