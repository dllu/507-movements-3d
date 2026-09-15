# Movements 181–182 — baked passive catch; source contours under review

The browser now loads a 50-mesh reconstruction driven by a 549,087-byte motion
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

The catch outline is traced from 181. The upper holding face is registered
three source pixels higher, with its toe extended two pixels along the ledge.
The lower holding heel moves six pixels right and five up. Its tripping nose
and holding heel share a continuous rear support. That support follows the
concave inner edge and convex outer rim of the crescent in 181. A narrow curved
bridge connects the registered heel, which extends beyond the drawn crescent;
the bridge is an inferred support, not an engraved feature.
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
The lower finger's holding heel still extends outside the engraved crescent, and
the catch's upper contour does not superimpose on both drawings. The upper horn's
rear offset is an interpretation of the two views, not a measured depth.
These contours need further work before either movement is marked fully reviewed.

## Passive transfer and contact correction

The [native study](validation/181-transfer-study.json) passes three complete
cycles at each of 0.0005-, 0.00025- and 0.000125-second timesteps. Both isolated
handles hold with zero friction, release under an external catch-lift control,
and fail to hold when contact is disabled. The previous 0.25 catch mass remains
a failed return control; the inferred 0.17 mass completes both transfers.

Every native solver step is checked. MuJoCo's soft contacts still penetrate by
up to 0.001348 model units (about 0.108 source pixels), so the raw native probe
intentionally fails its separate finite-clearance gate. Increasing contact
margin or deepening the notch upset retention in exploratory trials; these
alternatives are not used in playback.

The [offline projection](validation/181-projected-contact-motion.json) records
the second native cycle in 9,001 poses at 2 ms spacing. Small joint-position
corrections separate finite surfaces; no latch event is prescribed. Only 17
recorded poses require contact correction, each within three iterations. A
smooth correction over the final half-second of the settled bottom dwell
removes the residual settling offset and closes the loop exactly.

Including that loop correction, the largest angular change is 0.000783 radians
(0.045 degrees), and the largest piston shift is 0.000477 units (0.038 source
pixels). Across 36,001 interpolated poses at 0.5 ms spacing, minimum contact
clearance is 0.00002966 units. Independent intersections of unsplit polygon
unions at 901 poses find zero overlap and detect overlap in the uncorrected
trajectory. These are sampled checks, not continuous collision proof.

## Complete-assembly and browser checks

The [serialized assembly sweep](validation/181-baked-assembly-clearance.json)
checks all 50 meshes across 1,025 different-body pairs at 129 poses, with
8,898,074 finite-surface queries and no detected intersections. This includes
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
- `node scripts/bake-diagonal-catch.mjs`
- `node scripts/review-diagonal-catch-assembly.mjs`
- `node --test tests/diagonal-catch-baked.test.mjs tests/movement-181.test.mjs tests/movement-182.test.mjs tests/diagonal-catch-assembly.test.mjs`

The projection command writes its intermediate trajectory under `/dev/shm`;
the bake packages it in `src/simulation/baked/assets/181.json.gz`. Both movements
share this asset.

## Historical diagnostics and next work

The synchronous legacy registry remains as an input-geometry generator and
historical reconstruction. Its prescribed catch motion and six interfering
latch pairs are **not** the browser implementation. Its
[old assembly report](validation/181-current-solids.json),
[isolated baseline](validation/181-tappet-baseline.json) and
[isolated fitted-arm study](validation/181-tappet-study.json) describe earlier
steps. `scripts/review-diagonal-catch-solids.mjs` still audits that legacy model
and intentionally fails; use the baked-assembly command for current playback.

Continue the lower-finger and upper-catch source contours while preserving the
qualified contact surfaces and complete-assembly clearance. Neither movement
is fully reviewed yet. The full 507-movement goal remains active.
