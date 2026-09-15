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

## Traced-profile physics candidate

`src/simulation/mujoco-twin-cam/` now contains a separate, unregistered
candidate. Both convex cam outlines are traced approximately from the engraving;
the hidden lower half of the rear cam is reconstructed. Two rounds of Chaikin
refinement round the trace inside its convex hull. The visible plates and
collision meshes share these contours. The candidate includes bored plates,
levers and rollers, but does not yet include the output rods or complete supports.

Only the cam shaft is driven. Gravity and contact move the free lever hinges;
the rollers also spin freely. Assumed masses are uniform one-unit rods and
0.1-unit rollers, with no output load. These are prototype assumptions, not
mass properties derived from the final visible assembly.

The [0.5 ms probe](validation/149-gravity-prototype.json) and
[0.25 ms probe](validation/149-gravity-fine.json) each run three six-second
revolutions and measure the last revolution at 20 ms intervals. Maximum
corresponding lever-angle differences are 0.000153 rad (upper) and 0.0000773 rad
(lower). At the finer timestep the measured profile gap ranges from -0.000677
to 0.001587 world units. Eight upper and nine lower samples have no reported
contact. These sampled measurements do not establish continuous contact or
mesh convergence. Lever position closure is within 0.00000747 rad; roller-spin
closure and velocity continuity have not been established.

Three focused tests verify convex profiles, repeated passive lever motion, and
stationary follower coordinates when both gravity and contact are disabled.
Run `node --test tests/twin-cam-physics.test.mjs`; reproduce the diagnostic with
`node scripts/probe-twin-cam-physics.mjs` and optionally `TIMESTEP=0.00025`
and `REPORT=docs/validation/149-gravity-fine.json`.

The existing application remains on the analytic implementation. Complete the
rod geometry, load assumptions, collision review and bake validation before
switching playback to this candidate.
