# Movement 149: twin cam followers (review in progress)

The [source](https://507movements.com/mm_149.html) describes cams converting
uniform rotation into alternating rectilinear motion of two rods. Its animation
tab is unavailable. The implementation uses two convex polar cam profiles,
solves their roller-offset curves against fixed-length levers, and prescribes
continuous contact. It integrates roller spin when constructing the model.
It does not currently verify gravity return, applied rod loads or follower
lift-off dynamically.

## Working-surface correction

[The baseline surface check](validation/149-legacy-contact.json) found that both
cam plates and their decorative outline tubes penetrated their rollers. The
plates protruded about 0.014 world units because extrusion bevels expanded the
profile; the outline tubes also entered the working surface. The analytic
contact metadata did not represent these rendered details.

Bevels now inset the profile, and the smaller outline tubes sit inward on the
cam face. [Current evidence](validation/149-contact.json) checks both directions
between actual tread and plate/outline mesh samples at 65 poses: four pairs and
1,777,620 point/solid checks, with no penetration above `1e-6`. Roller-center
distance to the plate differs from the radius by approximately -`5.1e-9` to
0.000267 units, reflecting mesh discretization. This checks working contacts,
not the entire assembly or continuous swept motion. Run with `REQUIRE_CLEAR=1`
to enforce the clearance bounds.

Playback now takes six seconds per cam revolution instead of about 10.47.
The default view is nearly frontal, fog remains disabled, the ground plane is
hidden, and Restart is enabled. The focused analytic test, production build and
packaged desktop/mobile test pass, including exact restart, orbit controls and
no WASM request. The test uses matching time inputs for exact state comparisons;
velocity-error tolerances were adjusted for floating-point rounding at the
higher speed. These tolerances are not physical contact tolerances.

## Remaining reconstruction work

The frontal render shows that the rear cam is substantially broader than the
engraved upright profile, and the front cam also needs silhouette review. The
source cam outlines should be traced before treating the present polar-profile
motion as source-faithful. Cam contact is geometrically solved, but return
loading remains an assumption.

[Rod landmark evidence](validation/149-rod-landmarks.json) compares actual mesh
endpoints with approximate engraving endpoints at Y=414 and Y=430 pixels. The
upper rod ends about 119.4 pixels too early, and the lower about 26.5 pixels too
early. Extending them requires reviewing the invented base/supports and output
heads together. Pivot, roller and shaft bores and whole-assembly clearance are
also still unchecked.

The constructor currently generates two 16,385-sample roller-spin tables;
the local Node construction measured about 0.4 seconds. Once the geometry and
contact model are settled, precomputing the expensive motion data is preferable
to rebuilding it on every visit. Do not mark 149 complete from the working-pair
checks alone.
