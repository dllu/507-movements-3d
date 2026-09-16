# Movements 181–182 — baked passive catch; source contours under review

The browser now loads a 49-mesh reconstruction driven by a 520,179-byte motion
and geometry bake. The old circular latch pockets and cylindrical latch rollers
are removed. A continuous S-shaped catch, finite fingers, bored rear supports
and axial webs replace them. Both engravings show stages of the same mechanism;
182 starts halfway through the cycle. An 18-second native cycle is displayed
in 12 seconds. The browser runs neither MuJoCo nor contact projection.

The [original caption](https://507movements.com/mm_181.html) describes the piston
tappet closing one valve handle, the catch transferring engagement and the other
backweight opening its valve pair. Only the piston is actuated in the native
model. The weighted handles and catch move passively. The visible weight rods
remain vertical through ideal guidance; masses, inertias, friction and valve
travel stops are reconstruction assumptions.

## Source fit and visible assembly

Each working handle uses one rigid fit to its tip and weight pin in both plates,
registered at its pivot. The fit also requires the held tip to clear the finite
shoe. The traced working-arm curvature receives one fixed similarity transform;
it never changes shape during playback. Nominal travel is -0.995 radians for the
upper handle and -0.9446 for the lower. The inconsistent drawn positions require
an explicit compromise:

| Handle | Tip error in 181 | Tip error in 182 | Weight-pin error in each plate |
| --- | ---: | ---: | ---: |
| Upper | 10.37 px | 15.50 px | 10.70 px |
| Lower | 14.30 px | 6.43 px | 11.54 px |

These are nominal rigid-fit residuals, not whole-contour registration scores.
The baked settled angles differ slightly from those nominal values. Tip radius
is 0.10 model units (eight source pixels); the shoe spans registered source
X pixels 170–193. Its rounded tips use the same 64-sided section as the qualified
native contact geometry.

The catch body is traced from 181. Its rounded upper head is a compromise
between both plates: the lip and left shoulder move ten source pixels right
and four down, with a blended neck that retains the upper holding ledge.
The [head comparison](validation/181-source-head.json) registers both engravings
at their catch pivots and uses the baked catch angles without per-stage scaling.
Across two corresponding hand-selected landmarks in each drawing, RMS error
decreases from 17.61 to 12.61 pixels; maximum error is 14.92 pixels. This measures
those four points, not the entire contour. The two drawings have different
radial dimensions: each selected landmark's radius differs by about 20 pixels.
Even with arbitrary rotation, a rigid reconstruction must miss at least one
plate by about 10 pixels for each correspondence. The compromise is close to
that lower bound, though it is not a claim of globally optimal contour fit.

The upper holding face is registered
three source pixels higher, with its toe extended two pixels along the ledge.
The lower holding heel moves six pixels right and five up. The tripping and
holding edges now belong to one solid head, formed by the convex envelope of
the two fitted contact patches. This same boundary is used in MuJoCo and in
the visible finite plate; there is no hidden contact-only connector. Its rear
support follows the concave inner edge and convex outer rim of the crescent in
181 and joins directly to the head. The former narrow curved bridge and one
axial web are removed. The inferred head is broader than the pointed engraving;
moving the holding edge toward that point caused failed returns in trials.
The upper rear plate includes the horn visible in 182. At the opposite stage,
its extra length lies behind the piston rod; an inferred rear offset and bored
sleeve connect it to the hub. Axial webs connect both handles to their front
contact faces. The contact faces retain the geometry used in the native study.

The handle planes are -0.12 and +0.12; the catch is at +0.43. The upper rear
finger plate occupies -0.58 to -0.46. Its 0.12-radius bore clears the 0.11-radius
shaft. The lower backweight arm runs behind the rod at -0.68, with a bored
sleeve connecting it to the handle. All three weight rods have retained pins
and bored eyes. Depths, the unillustrated supports and displayed hanging weights
are inferred.

The piston rod has the source's 33-pixel width and wavy section cuts at rows
23 and 500. These are viewing limits on a longer translating rod, not physical
ends or a telescoping member. The section stays in this window while its shoe
moves. The tappet's end face carries the engraving's diagonal hatching, drawn
as surface marks so its travel remains legible from the front. The rod's 0.17-unit depth at z=-0.355 clears the rear weight eye and front arm.
Fog, ground, the former added frame and floating contact markers are disabled.

The front and oblique views are improved, but source review is **not complete**.
The lower finger is now one continuous solid, but its head remains broader
than the engraved crescent.
The catch's upper contour retains the quantified compromise above; the upper
horn's rear offset is an interpretation of the two views, not a measured depth.
The lower head's width needs further source review before either movement is marked
fully reviewed.

## Passive transfer and contact correction

The [native study](validation/181-transfer-study.json) passes three complete
cycles at each of 0.00025-, 0.000125- and 0.0000625-second timesteps. The former
0.0005-second timestep now completes all three cycles with the continuous
finger; it remains in the report as a sensitivity check. The native model now defaults to 0.00025
seconds, matching the bake's integration step. Both isolated
handles hold with zero friction, release under an external catch-lift control,
and fail to hold when contact is disabled. The heavier 0.25 catch mass also
completes all three cycles with the continuous head. This is a sensitivity
result, not a required failure control; the bake retains the inferred 0.17 mass.

Every native solver step is checked. MuJoCo's soft contacts still penetrate by
up to 0.001519 model units (about 0.122 source pixels), so the raw native probe
intentionally fails its separate finite-clearance gate. Increasing contact
margin or deepening the notch upset retention in exploratory trials; these
alternatives are not used in playback.

The [offline projection](validation/181-projected-contact-motion.json) records
the second native cycle in 9,001 poses at 2 ms spacing. Small joint-position
corrections separate finite surfaces; no latch event is prescribed. Only 13
recorded poses require contact correction, each within three iterations. A
smooth correction over the final half-second of the settled bottom dwell
removes the residual settling offset and closes the loop exactly.

Including that loop correction, the largest angular change is 0.000757 radians
(0.044 degrees), and the largest piston shift is 0.000445 units (0.036 source
pixels). Across 36,001 interpolated poses at 0.5 ms spacing, minimum contact
clearance is 0.00002972 units. Independent intersections of unsplit polygon
unions at 901 poses find zero overlap and detect overlap in the uncorrected
trajectory. These are sampled checks, not continuous collision proof.

## Complete-assembly and browser checks

The [serialized assembly sweep](validation/181-baked-assembly-clearance.json)
checks all 49 meshes across 988 different-body pairs at 129 poses, with
8,397,036 finite-surface queries and no detected intersections. This includes
the rear plates, axial webs, shafts, weight joints and sectioned rod. It uses
rendered triangle surfaces rather than nominal contact radii. The earlier six
latch intersections are absent from this reconstruction.

Seven targeted tests pass: the retained four input-model tests plus three new
baked-model tests. The latter check full-loop transforms, exact Restart, retained
weight joints, the stationary section window, both transfer endpoints and
rendered vertices against the qualified contact envelopes. The bake records
geometry and motion provenance in [181-bake.json](validation/181-bake.json).
The build and [packaged desktop/mobile checks](validation/181-browser.json)
pass playback, Restart, orbit/reset, layout, no WASM requests and no page errors.

Reproduce the current checks with:

- `node scripts/project-diagonal-catch-motion.mjs`
- `node scripts/review-diagonal-catch-source.mjs`
- `node scripts/bake-diagonal-catch.mjs`
- `node scripts/review-diagonal-catch-assembly.mjs`
- `node --test tests/diagonal-catch-baked.test.mjs tests/movement-181.test.mjs tests/movement-182.test.mjs tests/diagonal-catch-assembly.test.mjs`

The projection command writes its intermediate trajectory under `/dev/shm`;
the bake packages it in `src/simulation/baked/assets/181.json.gz`. Both movements
share this asset. The source-review command writes a pivot-registered contour
overlay to `/dev/shm/181-source-head.html` and the landmark measurements to
`docs/validation/181-source-head.json`.

## Historical diagnostics and next work

The synchronous legacy registry remains as an input-geometry generator and
historical reconstruction. Its prescribed catch motion and six interfering
latch pairs are **not** the browser implementation. Its
[old assembly report](validation/181-current-solids.json),
[isolated baseline](validation/181-tappet-baseline.json) and
[isolated fitted-arm study](validation/181-tappet-study.json) describe earlier
steps. `scripts/review-diagonal-catch-solids.mjs` still audits that legacy model
and intentionally fails; use the baked-assembly command for current playback.

Continue the lower-finger source contour while preserving the
qualified contact surfaces and complete-assembly clearance. Neither movement
is fully reviewed yet. The full 507-movement goal remains active.
