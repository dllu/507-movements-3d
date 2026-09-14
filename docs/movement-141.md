# 141: endless-band saw review

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

## Replacement path and remaining work

`band-saw-path.js` uses the measured spacing and radius, exact tangent joins and
constant material speed. A complete blade circuit takes twelve seconds; each
wheel revolution takes about 3.89 seconds. The candidate blade is 0.005 units
thick with a 0.12-unit axial width. Its teeth project beyond the tread's front
face rather than cutting into it. Thickness, width and hidden depths are inferred.
Tests check path/tangent continuity, constant speed and the wheel-speed relation.

The browser still loads the old model. Rebuild the casting, table passages,
wheels and band around this path. Use an unbeveled working tread and check the
actual finite ribbon against the wheel facets; avoid a coarse ribbon chord
cutting through a rotating wheel. Teeth need to stay attached along the curved
wraps. Verify shaft support, blade/table clearance, complete motion bounds,
rendering, restart and packaged desktop/mobile playback before advancing to 142.

```sh
node scripts/review-band-saw.mjs
node --test tests/band-saw-path.test.mjs
```
