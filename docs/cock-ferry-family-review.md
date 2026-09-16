# Four-way cock and reaction ferry: 395 and 447

Twenty-fifth family pass. These are independently prescribed mechanisms, using
the existing finite plate, passage, bearing and spherical-joint helpers.

## Sources

[395](https://507movements.com/mm_395.html) shows the same plug at two positions
separated by a quarter turn. Its two curved passages swap the cylinder's supply
and exhaust connections. [447](https://507movements.com/mm_447.html) shows a boat
held by an upstream tether, with the stream acting on its rudder. Both complete
HTML pages were checked: neither contains an animation model/library setup.
The engravings and captions define topology, not dimensions or timing.

## Corrected geometry

395 previously put two colored curves over a solid plug and represented pipe
bores by darker solid cylinders. The plug now has two actual curved channels,
extended radially to its outside surface. A finite rear floor and open front
make this an explicit cutaway. The housing has four matching openings, and
sectioned external conduits have side and rear walls with clear internal paths.
Flow cores and markers lie in those paths instead of floating in front of the
hardware. The plug/body radial clearance decreases from 0.070 to 0.008 units.

The existing indexed connection maps, quarter-turn law and smooth dwells remain.
The centerline metadata now ends at the actual plug interface. Markers still
pause between indexed positions: the visible finite ports can partially overlap
during a turn, but no transient throttling or pressure law is asserted.

447 previously floated its hull and horizontal rudder plank above the river.
The narrower hull now intersects the waterline, with two rectangular recessed
compartments closer to the plan engraving. Their floors remain above the water.
A vertical rudder blade, connected by a submerged bracket, reaches the current;
a separate tiller retains the visible plan action. A bored stock bearing and a hull passage clear the rudder
shaft. Compact inferred swivels join the tether to the bow and anchor without
passing the rope through solid posts. The bow fitting has a relieved hull recess.

The exact constant-length tether, radial heading convention, sinusoidal traverse
and cosine rudder reversal remain analytical. The river's upper surface now
matches its declared waterline. Near-plan framing includes both banks and the
full swept ferry; the former default view clipped scene vertices.

Both models disable fog and the generic ground. Transparent water/fluid parts
do not cast opaque shadows. Minimum display cycles are eight seconds for the
cock and 6.2 seconds for the ferry. Geometry and GPU buffers remain stable during
playback.

## Verification and limits

The 17 existing tests retain routing, rigid transforms, cycle closure, exact
tether length and analytical motion derivatives. Six scoped tests in
`cock-ferry-working-solids.test.mjs` independently probe channel cavities and
floors, check flow-marker containment, sample finite rotating interfaces in both
directions, verify hull immersion/dry compartment floors/rudder depth and check
bank clearance and storage stability.

Camera comparisons, final packaged desktop/mobile checks and the production
build are recorded in `review-progress.md`; bulk captures remain in `/dev/shm`.
The 23 focused checks pass. Final serial Chrome source comparisons report no
errors or clipping over 17 poses, with maximum projected extents 0.895 (395)
and 0.908 (447), where 1 is the viewport boundary.

The cock's open section and rectangular conduit sections explain its routing;
they are not manufacturing drawings or a leak-tight fluid simulation. Seal
compression, operating torque, pressure loss and transient overlap remain
unsolved. The ferry does not solve buoyancy, lift/drag, cable tension, sag or
bank docking. The river is an illustrative envelope, not a fluid domain with
the submerged hull subtracted. The swivel fittings, rudder depth, compartment
floors and support details are inferred geometry. These geometric checks do not
qualify passive fluid-driven operation.
