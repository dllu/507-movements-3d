# 141: reconstructed endless-band saw

The [source caption and animation](https://507movements.com/mm_141.html) show
continuous wheel rotation producing straight-line blade motion. Equal wheels
and an open belt path admit a simple analytic solution; this does not need
MuJoCo. The replacement will retain continuous downward travel on the cutting
run and upward travel on the return run.

## Measured defects

The engraving's wheel centres are approximately (315, 73) and (315, 400), with
50-pixel radii. Registering the old animation-derived layout at both centres
gives a pitch radius of only 46.71 pixels. Its table spans approximately x264–497
at y344, compared with the drawing's x247–515 at y334. The casting proportions
also need reconstruction. Measurements are in `band-saw-dimensions.js`.

The old teeth intersect the wheel tread at every one of 64 checked phases.
Finite tooth vertices penetrate the nominal, un-beveled annulus by up to
0.00576 world units, or 0.468 engraving pixels at the registered scale. The
tooth roots start at z0.10, inside the tread's front face at z0.14. Independently,
the actual beveled rim extends 0.005004 units beyond the specified blade inner
radius. These are real overlapping depths, not harmless projected overlap.
See [the hashed mesh review](validation/141-review.json).

## Replacement and validation

`band-saw-path.js` uses the measured spacing and radius, exact tangent joins and
constant material speed. A complete blade circuit takes twelve seconds; each
wheel revolution takes about 3.89 seconds. The candidate blade is 0.005 units
thick with a 0.12-unit axial width. Its teeth project beyond the tread's front
face rather than cutting into it. Thickness, width and hidden depths are inferred.
Tests check path/tangent continuity, constant speed and the wheel-speed relation.

The browser now loads `band-saw.js`: a measured curved column, open six-spoke
wheels, bored hubs and bearings, slotted table, semicircular table support and
connected central pedestal. The front and oblique views follow the engraving's
layout. Hidden supports and axial depths remain inferred.
The traced column foot extends two pixels to meet the base across its width;
the framing also leaves room for the inspected oblique view.

The working tread has no bevel. A 256-facet half-wrap ribbon follows exact tangent
stations. Its inner chords stay outside the entire wheel-radius envelope, even
as the wheel facets rotate. The 0.00002-unit tread inset exceeds the ribbon's
chord sag while keeping the residual gap below 0.01 engraving pixels. This is
checked using actual mesh vertices and segment distances, not nominal radii alone.

The 128 moving teeth use the same path for their vertices on the straight runs
and wraps. Their roots are at z0.06, ahead of the tread face at z0.045. Both blade
runs pass through actual open slots in the table; their complete straight-run
cross-sections clear those cuts. The table support connects to its pedestal,
and the wheel hub bores clear the shafts.

Five focused tests cover the previous diagnosis, path continuity, speed relation,
finite ribbon clearance, tooth/table clearance, supports, actual motion bounds,
fog and restart. Packaged desktop/mobile animation, restart and visual review
pass without WASM. The scene uses its own base and no ground plane. The blade
circuit takes twelve seconds, with approximately 3.89-second wheel revolutions.
No material-cutting forces or flexible-blade dynamics are claimed.

```sh
node scripts/review-band-saw.mjs
node --test tests/band-saw-path.test.mjs tests/band-saw-geometry.test.mjs
```
