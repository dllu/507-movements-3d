# Movement 170 — baked crossed-arm governor

170 now loads a 408,398-byte geometry/motion bundle and plays four interpolated
coordinates. The arms, upper links and output are baked from passive MuJoCo
dynamics; equal bevel gearing is scripted. The browser neither runs MuJoCo
nor generates bevel geometry. There are 88 meshes and 481 animation keys.
Three spindle revolutions occupy one 9.606218-second speed cycle.

## Source and finite construction

The [source page](https://507movements.com/mm_170.html) has no working animation
script. Its defining feature is that the ball arms cross, continue above the
spindle and connect directly to the valve rod through two short links. There
is no lower sleeve sliding on the spindle. The replacement retains that
topology, the bowed reference piece and the two bevel gears; the added frame
and index decorations are removed. Ground and fog are disabled.

The geometry follows the front engraving at 0.017 world units per pixel.
The central pivot is near (264,160), balls near (176,319)/(355,319), upper wrists
near (295,108)/(233,108), and gear apex near (264,456). Small asymmetries are
averaged to make a balanced mechanism. The initial baked ball centers are
within three pixels of those measured centers. This is a joint-position check,
not whole-contour registration. Hidden support, depths and pin clearances are
inferred. The visible valve rod ends near the source's upper crop.

A forked spindle head leaves space for the crossed arms. Real bores surround
the central and wrist pins. Upper links occupy separated depth planes
(+/-0.275), matching the native study. Two short radial output pins leave the
axial valve-rod bore unobstructed. A rotating collar is captured between two
flanges on the nonrotating rod. This is an ideal bearing representation with
clearance; thrust-bearing friction and detailed rolling elements are omitted.

The equal 30-tooth bevel pair uses the shared Tredgold back-cone involute
approximation with conical tooth ends, not an exact generated octoid flank.
Counts and face widths are inferred. The outer radius is 0.629 world units.
The [tooth-pitch sweep](validation/170-bevel-clearance.json) finds no sampled
interference across 65 phases and 961 pairs; nearest sampled flank clearance
is 0.002305–0.002310 world units. Teeth transmit prescribed equal-ratio motion,
not simulated tooth contact forces.

## Native motion and bake

One spindle actuator drives the MuJoCo model. Both arms, short links and the
axial output are passive, with ideal hinge and connection constraints. The
output slide represents the direct upper valve bearing, not a sleeve on the
lower spindle. Ball mass is 1 per ball; arm mass, link mass, output mass and
damping are inferred. No steam feedback or valve pressure force is modeled.

The [eight-case study](validation/170-native-study.json) includes timestep,
load, constant-speed and no-drive variations. Large speed excursions with weak
damping can reverse the upper-link branch, and heavier output changes the
response. Those failure cases are not used in production. The selected drive
has a 6% peak speed increase and arm damping 1, with output mass 0.02.

The [settled-cycle report](validation/170-native-cycle.json) compares all
corresponding generalized positions and velocities through the last two of
forty cycles at two timesteps. The fine-step maximum cycle errors are below
8.84e-10 in position and 2.37e-10 in velocity; maximum link closure error is
2.23e-8. Halving the timestep changes sampled spread by 2.57e-5 radians and
output by 3.83e-5 world units. Settled spread ranges from 0.517094 to 0.760822
radians, and output from 1.285516 to 1.627042 world units.

The bake starts near the engraved spread, preserves three full turns per loop,
and records native midpoint interpolation error below 9.63e-6 across its four
coordinates. This is sampled interpolation evidence, not a continuous error
bound. Native runs remain in `/dev/shm`; the compact production bundle and
[provenance](../src/simulation/baked/assets/170.provenance.json) are committed.

## Clearance and playback validation

The [legacy audit](validation/170-existing-contact.json) found intrusion at
all seven selected pin/collar interfaces. During replacement, a solid spindle
top also crossed the arms; the forked head resolves that interference.

The [native-pose solid sweep](validation/170-solid-clearance.json) checks
129 poses and 2,459 cross-body pairs with 54,198,170 bidirectional queries.
The [loaded-bake sweep](validation/170-baked-solid-clearance.json) repeats the
check through interpolated playback with 54,375,472 queries. Neither finds
sampled penetration above 1e-6 world units. Same-body joins are excluded.
Both scripts reject nonfinite transforms and empty query sets.

Three tests check finite transforms, complete motion bounds, link-end closure
between bake keys, exact restart, three-turn loop continuity and initial ball
positions. The production build and packaged Chrome desktop/mobile checks pass, including
playback, exact restart, orbit/reset, no WASM request, no page errors and no
horizontal mobile overflow. Front and oblique views were inspected. The
[browser record](validation/170-browser.json) identifies the tested files.

```sh
node scripts/settle-crossed-governor.mjs
node scripts/bake-crossed-governor.mjs
node scripts/review-crossed-governor-baked-solids.mjs
node --test tests/crossed-governor-baked.test.mjs
```

The full 507-movement review remains active. Next source review: 171.
