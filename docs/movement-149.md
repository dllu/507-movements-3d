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

## Guided output candidate

The current candidate connects each ordinary pinned rod to a vertical output
slider at its lower end. The rod can tilt as its upper pin follows the lever;
the output pin remains on a straight vertical line. Rear channels, lower rod
bosses and a rear shaft-bearing frame make this engineering interpretation
visible. These features are **inferred**, not details shown in the engraving.
The two source-length rods and traced cam silhouettes are retained.

All nine moving coordinates remain native MuJoCo coordinates. Only the cam
shaft is driven; two point constraints connect rod tips to free vertical slides.
Cam, lever, roller, rod and slider inertias come from the visible geometry at a
common density. Bearing friction, damping, dimensions hidden in the engraving
and the absence of an external output load remain assumptions.

The [60-second guided probe](validation/149-guided-rods.json) and
[finer timestep probe](validation/149-guided-fine.json) measure the final
six-second revolution. Halving the timestep from 0.5 to 0.25 ms changes sampled
lever angles by at most 0.000104 rad and slider positions by 0.000289 world
units. In the fine run, maximum pin mismatch is 0.000000272 units; slider
position closure is within 0.00000342 units. Rod inclination stays below 1.71
and 1.05 degrees. This replaces unconstrained pendulum sway with a constrained
rod linkage and rectilinear output sliders.

Position closure does not prove a perfectly smooth bake. At the fine timestep,
upper slider velocity differs by 0.00251 units/s across the cycle boundary and
upper roller spin velocity by 0.0543 rad/s. Profile gap ranges from -0.000562 to
0.002039 units, with brief contact losses. Baking must account for these measured
residuals and check the interpolated motion; do not claim exact rolling contact.

The [33-part assembly check](validation/149-guided-assembly.json) includes the
channels, pins, retainers and bearing frame. It finds no unintended overlap in
7,751,612 bidirectional point/solid checks at 61 poses. Working cam/roller soft
contact is reported separately (maximum sampled mesh depth 0.000490 units).
This remains sampled evidence rather than a continuous swept-volume proof.
Five focused tests pass, including native pin alignment and constant output X.
Preview framing includes the broad cam's complete circular sweep, which extends
farther right than its source pose.

Reproduce current evidence with `node --test tests/twin-cam-physics.test.mjs`,
`node scripts/review-twin-cam-candidate.mjs`, and
`DURATION=60 node scripts/probe-twin-cam-physics.mjs`; use `TIMESTEP=.00025`
and `REPORT=docs/validation/149-guided-fine.json` for refinement.
The application still uses the older analytic version. Offline baking,
interpolation checks and packaged playback validation are next.

## Historical freely suspended rod candidate (d181801)

`src/simulation/mujoco-twin-cam/` contains a separate, unregistered candidate.
Both convex cam outlines are traced approximately from the engraving; the
hidden lower half of the rear cam is reconstructed. Two rounds of Chaikin
refinement round the trace inside its convex hull. Visible plates and collision
meshes share these contours.

The candidate now has tapered, bored levers, roller axles, ordinary pinned rod
heads and output rods ending at the approximate source Y=414/430 pixel landmarks.
Depth spacing lets the upper rod pass behind the lower lever. The 18 visible
parts were rendered beside the engraving at the source, quarter and half-turn
poses without browser errors. This is still missing fixed bearing supports.

Only the cam shaft is driven. Gravity and contact move free lever hinges;
rollers and output rods have free hinge joints. Full mass tensors are integrated
from the visible moving parts at a common density, normalized to upper-lever
mass 1. Rod hinge damping of 0.002 is assumed, and there is no external output
load or inferred guide. Tests verify rod endpoints, coaxial pins, compiled body
masses/centroids, convex profiles, passive motion and removal of all follower
motion when contact and gravity are disabled.

[The candidate assembly check](validation/149-pinned-assembly.json) samples all
visible mesh pairs at 61 poses from 12 to 18 seconds: 5,283,754 bidirectional
point/solid checks and no unintended penetrations above 1e-6. Soft cam/roller
contacts are reported separately, with sampled mesh penetration up to 0.000323
world units. This is not a continuous collision proof and excludes the absent
bearing supports.

[The 60-second dynamics probe](validation/149-pinned-rods.json) shows why this
candidate is not ready for baking. In the last six-second revolution, rod tilt
reaches 2.28 degrees (upper) and 2.74 degrees (lower). The lower rod differs by
0.0532 rad between cycle endpoints, even though lever position closure remains
within 0.00000157 rad. Ordinary freely suspended rods do not establish the
caption's rectilinear output or a seamless repeating cycle. A source-supported
guidance/connection interpretation remains necessary; do not hide the sway by
forcing the rendered rods vertical independently of the physics.

Run `node --test tests/twin-cam-physics.test.mjs` and
`node scripts/review-twin-cam-candidate.mjs`. Reproduce the longer probe with
`DURATION=60 REPORT=docs/validation/149-pinned-rods.json node scripts/probe-twin-cam-physics.mjs`.

The earlier [0.5 ms](validation/149-gravity-prototype.json) and
[0.25 ms](validation/149-gravity-fine.json) reports are historical evidence for
commit f2e9598's unloaded-rod prototype. Their timestep agreement does not
validate the changed mass model and freely suspended rods.

The application remains on the analytic implementation. Resolve output guidance,
complete supports, repeat contact/assembly and timestep checks, then validate an
offline bake before switching production playback.
