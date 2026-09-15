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
