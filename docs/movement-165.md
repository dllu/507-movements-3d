# Movement 165 — waved face cam

The cam now has six identical sinusoidal lobes, equally spaced around its axis.
The irregular hand-drawn silhouette is no longer used as the working profile.
The 0.18-unit amplitude limits crown curvature so the 0.882-radius roller can
enter every opening. Apparent differences in opening width in the front view
come from projecting the circular rim.

The [original engraving and caption](https://507movements.com/mm_165.html)
provide the mechanism, roller size, lever and shaft proportions. The rim height
is `rollerY + rollerRadius - amplitude + amplitude*cos(6*angle)` at every radius.
There is no special roller-shaped relief. The thin rim, top web, bearing depths,
ideal fulcrum and vertical output guide remain reconstruction assumptions.

Production solves finite-roller contact offline under a quasistatic seating
assumption. It includes the roller's full axial width and searches the angular
extrema of the cam surface. The browser interpolates three baked coordinates;
it does not run MuJoCo or generate this geometry. One revolution takes 12 seconds.
The compressed asset is 313,821 bytes, with 2,259 keys selected from 9,350 solves.
Maximum accepted interpolation probe error is below 2e-6 radians.

The [current solid audit](validation/165-baked-clearance.json) checks all 13
physical meshes over 721 poses: 25,696,970 finite-surface queries find no sampled
cross-body intersection above 1e-6 units. Independent refined contact tests check
seating, equal-lobe periodicity, finite-roller gaps, pin alignment, guide travel,
looping, framing and restart. This is sampled clearance evidence, not continuous
collision proof. Production build and desktop/mobile Chrome checks pass.

The old source-projection and traced-profile reports are historical evidence for
the superseded irregular cam. Their subpixel trace-fit claims do not describe
the corrected sine cam. Current generation inputs and checksums are recorded in
[bake provenance](../src/simulation/baked/assets/165.provenance.json).
