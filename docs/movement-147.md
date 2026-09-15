# Movement 147: air-drag governor (review in progress)

The [source](https://507movements.com/mm_147.html) describes a heavy, loose
crosshead driven by two inclined circular planes on the shaft. Air resistance
retards its fans, so its rollers climb the planes and lift a regulating lever.
The current implementation instead assigns lag and lift directly from the
prescribed shaft-speed fraction. It does not calculate fan drag, gravity,
crosshead inertia or passive roller response.

The [actual roller/ramp diagnostic](validation/147-legacy-contact.json) finds
penetration in 64 of 65 poses, up to 0.07066 world units. It tests actual cylinder
vertices, edge midpoints and triangle centers against both ramp solids, excluding
decorative rims. The old contact-height metadata only compares the roller's
bottom point with a ramp centerline; it does not establish tangency to a slope.
Finite roller width and the varying slope across the circular track must also
be addressed. The existing kinematic test passes despite these penetrations.

One independent defect is fixed: the regulating lever now has an actual slot
and pivot bore, replacing the black box laid over a solid beam. The follower
pin has 0.003 units of radial clearance. A triangle-surface test at 129 poses
checks the 0.12-radius pin around its circumference; clearance exceeds 0.0027.
The existing 147 test and production build pass with that joint correction.

Continue with a passive contact/drag model, preferably validated in MuJoCo and
baked for browser playback. Do not retain the speed-to-lag prescription as proof
of governor behavior. Also remeasure the source proportions: the engraved fan
panels are substantially taller relative to their width than the current panels.
The governor as a whole remains unverified.

## Passive physics prototype

`mujoco-fan-governor/physics.js` now provides a separate offline prototype.
Only the shaft has an actuator. The crosshead has free axial and yaw joints;
both crowned rollers have free radial-axis hinges. Gravity and roller/track
contact produce lift, while a quadratic resisting torque `-D ω |ω|` acts on
the actual crosshead speed. No crosshead position or lift force is prescribed.
It uses the shared MuJoCo allocation/stepping owner and explicit body inertias;
see the [MJCF reference](https://mujoco.readthedocs.io/en/stable/XMLreference.html).

The assumed tracks rise quadratically with lag. An initial constant-pitch
experiment ran over the track ends under sufficient drag: its gravitational
restoring torque does not increase with lift. Increasing slope gives a stable
operating point in the tested range. This profile, lumped inertia, drag
coefficient and crowned-roller contact are assumptions, not recovered dimensions
or an aerodynamic calibration. The rotating track is decomposed into convex
cells; the shipped cylinders have not yet been replaced with matching crowns.

[Prototype evidence](validation/147-passive-prototype.json) records six-second
runs. At 3 rad/s shaft speed, crosshead center height settles near -0.335 without
air drag and +0.341 with drag. At 1.5 rad/s with drag it settles near -0.286.
Halving the 0.001-second timestep changes the final height by less than `1e-5`;
doubling the 160 track cells changes it by about `0.00004`. These are steady-state
comparisons, not convergence of every transient sample. Three tests cover these
responses and show that the crosshead remains stationary when contact and
gravity are disabled while the driven shaft still turns.

The prototype is not registered in the application. Next: match source geometry
and mass properties, check actual working surfaces and track-end margins during
speed increases and decreases, then bake the validated motion. The original
browser motion remains provisional until that replacement is ready.

## Candidate geometry and working surfaces

The separate `mujoco-fan-governor/geometry.js` candidate now has approximately
84-by-196-pixel fan panels, a smoothed bored weight, stepped roller journals,
bored crowned rollers and a track foundation connected to the shaft. A shared
track-cell generator supplies both the visible convex solids and the physics
meshes. The candidate is not registered in the application and does not yet
include the regulating lever. The track endpoints and the complete assembly
still need source and clearance review; the current high track ends extend
above the operating rollers in the candidate view.

Mass properties are integrated from the candidate weight, sleeves, arms, panels
and rollers. An optional physics input uses these tensors and centers, normalizing
the crosshead to one mass unit with a common density for its rollers. Uniform
density, plate thicknesses, hollowing and small overlaps at rigid joins are
approximations; this is not a measured material or mass calibration.

[Working-surface evidence](validation/147-candidate-surfaces.json) compares all
1,280 compiled track vertices with the visible cells (maximum error about
`3.3e-8`). During the six-second startup it checks 288 native contacts against
the visible crowns and tracks. Contact positions stay more than 0.10 units from
the crown ends. The spherical proxy extends beyond the bored crown at its poles,
but those regions do not contact the track in this run. Crown discretization
error is below 0.00015 units; the maximum native penetration after two seconds
is below 0.00006. These are sampled working-contact checks, not full-assembly
collision validation. Contact copies are released explicitly, following the
[WASM binding ownership guidance](https://github.com/google-deepmind/mujoco/blob/main/wasm/README.md).

Four physics tests now pass, including compiled geometry-based mass and fan
aspect ratio. Candidate front and oblique views were inspected. Next: finish
the source-faithful assembly and output lever, validate acceleration and
deceleration with track-end margins, then bake and register playback.
