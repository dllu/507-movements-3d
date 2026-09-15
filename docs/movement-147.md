# Movement 147: baked air-drag governor (transient refinement open)

147 now loads baked MuJoCo motion and prebuilt geometry through
`baked/fan-governor.js`. The browser does not load MuJoCo or generate track cells.
The 1.83 MB compressed bundle contains 601 poses and nine merged meshes. It
starts in a raised configuration with the fans facing forward, then repeats a
six-turn speed cycle lasting 18.85 seconds. The collar and regulating lever are
unloaded analytic followers of the simulated lift.

Seven focused physics, joint and playback tests pass. Baked interpolation is
checked at 1,201 poses, including between recorded samples, with sphere/track
separation and penetration below 0.0005 units. Framing, fog removal, loop seam
and deterministic restart pass. The production build and packaged desktop/mobile
test pass, including orbit controls and no WASM request. Front, moving, oblique
and mobile renders were inspected. The high ramp end still partially occludes
the rear roller, particularly at low lift; exact ramp curvature remains inferred.

[Independent refinement evidence](validation/147-refinement.json) compares the
320-cell, 48,000-tick bake source with a halved timestep and, separately, 640
cells. Maximum lift differences are respectively 0.000568 and 0.04267 units;
maximum lag differences are 0.00114 and 0.04118 radians. The cycle closes, but
the transient response is **not fully mesh-converged**. This remains an open
follow-up. The replacement is shipped for its improved geometry, real joints,
passive lift and sampled contact clearance; it is not an aerodynamic calibration
or proof of an exact transient response.

## Legacy findings

The [source](https://507movements.com/mm_147.html) describes a heavy, loose
crosshead driven by two inclined circular planes on the shaft. Air resistance
retards its fans, so its rollers climb the planes and lift a regulating lever.
The previous implementation instead assigned lag and lift directly from the
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

These findings motivated the passive model and remeasured fan proportions below.

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
doubling the 160 track cells changes it by less than `0.001`. These are steady-state
comparisons, not convergence of every transient sample. Three tests cover these
responses and show that the crosshead remains stationary when contact and
gravity are disabled while the driven shaft still turns.

The live prototype remains available offline. Its matched geometry and refined
speed cycle now supply the registered bake described above.

## Candidate geometry and working surfaces

The separate `mujoco-fan-governor/geometry.js` candidate now has approximately
84-by-196-pixel fan panels, a smoothed bored weight, stepped roller journals,
bored crowned rollers and a track foundation connected to the shaft. A shared
track-cell generator supplies both the visible convex solids and the physics
meshes. The candidate supplies the registered baked application model. It includes a
regulating lever and collar, described below. The high ramp end still partially
occludes the rear roller in the candidate front view.

Mass properties are integrated from the candidate weight, sleeves, arms, panels
and rollers. An optional physics input uses these tensors and centers, normalizing
the crosshead to one mass unit with a common density for its rollers. Uniform
density, plate thicknesses, hollowing and small overlaps at rigid joins are
approximations; this is not a measured material or mass calibration.

[Working-surface evidence](validation/147-candidate-surfaces.json) compares all
2,560 compiled track vertices with the visible cells (maximum error about
`3.3e-8`). During the six-second startup it checks 274 native contacts against
the visible crowns and tracks. Contact positions stay more than 0.10 units from
the crown ends. The spherical proxy extends beyond the bored crown at its poles,
but those regions do not contact the track in this run. Crown discretization
error is below 0.00015 units; the maximum native penetration after two seconds
is below 0.0001. This check now uses 320 cells and a 0.0005-second timestep:
the updated neck inertia caused the 160-cell run to exceed that penetration
threshold (0.000163 even after halving the timestep). These are sampled
working-contact checks, not full-assembly
collision validation. Contact copies are released explicitly, following the
[WASM binding ownership guidance](https://github.com/google-deepmind/mujoco/blob/main/wasm/README.md).

Four physics tests pass, including compiled geometry-based mass and fan
aspect ratio. Candidate front and oblique views were inspected.

## Repeated speed-cycle probe

The candidate ramps now span -1.3 to +0.3 radians each instead of a full half
turn, removing unused high ends. These endpoints are operating-range assumptions,
not source measurements. The steady-speed controls and surface checks still pass.
Front and oblique views were inspected; the remaining high end still partially
occludes the rear roller.

The optional shaft drive now accepts a periodic speed command. The new probe
varies shaft speed from 1.3 to 2.7 rad/s over six shaft turns, discards six warmup
cycles, and samples the following cycle at 601 poses. Carrier lift, yaw and roller
spin remain unconstrained. [Cycle evidence](validation/147-speed-cycle.json)
records the pre-output-joint candidate's contact angles, actual sphere-to-visible-track separation, penetration,
and position/velocity closure. The sampled contacts stay over 0.4 radians from
the ramp ends. Brief contact losses have gaps below 0.000004 world units.

The coarse run is **not a seamless bake**: the carrier height differs by about 0.0096 units
and yaw by 0.034 radians between cycle endpoints. Roller spin need not repeat
because the crowns are rotationally symmetric, but carrier motion must repeat
smoothly. The probe deliberately records this failure rather than overwriting
its final pose to force a loop.

[A refined run](validation/147-speed-cycle-fine.json), with 320 cells and 48,000
ticks per cycle, closes carrier height and yaw within `3e-10` and their velocities
within `3e-8`, without modifying the endpoint. Its maximum sampled separation is
below `5e-7`, penetration below `0.000039`, and track-end margin above 0.39
radians. This is a promising offline bake candidate, but jointly changing mesh
and timestep does not independently establish transient convergence. Separate
refinement checks are documented above. This refined report has been regenerated
with the retaining-flange mass included.

## Regulating lever and assembly clearance

The candidate has a bored, nonrotating collar captured between retaining flanges
on the rotating neck. Its pin slides in a short, genuinely open slot in a tapered
lever. A bored pivot at the lever's right end accommodates the vertical collar
motion. The pivot location, slot, collar groove, clearances and small rear support
are reconstruction assumptions: the engraving does not specify these details.
The collar and lever follow simulated lift analytically, with no prescribed
crosshead motion. Valve load, collar friction and output inertia are omitted;
the rotating neck's new flanges are included in the crosshead inertia.

`tests/fan-governor-output.test.mjs` checks 65 lifts from -0.34 to +0.50 while
rotating the crosshead. Actual collar mesh points clear the grooved neck by more
than 0.0045 units; pin cross sections clear the slot by more than 0.0045 and the
pivot bore by more than 0.0028. The four passive-physics tests also pass.

[Assembly evidence](validation/147-candidate-assembly.json) checks all 346
visible parts at 65 sampled poses from the refined speed cycle, excluding only
joins within the same rigid family. The 6,325 moving-body pairs produce no
penetrations exceeding tolerance in 371,112,950 point/solid checks. Working
crown/track pairs allow 0.0002 for contact compliance and crown discretization;
other pairs allow 0.000001. Surface sampling can miss contact between samples,
so native working-contact checks remain necessary. This is not a continuous
swept-volume proof. Front and oblique views with the new lever were inspected.

## Rebuilding the bake

Run the speed-cycle probe with `TRACK_SEGMENTS=320`, `CYCLE_TICKS=48000` and
`CYCLE_REPORT=docs/validation/147-speed-cycle-fine.json`. Preserve its private
samples as `/dev/shm/147-cycle-baseline.json` before running other probes. Run
the assembly check against those same samples, then `scripts/bake-fan-governor.mjs`.
The bake verifies assembly/source hashes and cycle closure. Geometry is merged
only within each rigid body and material; normals and vertex positions are
preserved. The phase is shifted to maximum recorded lift, retaining the periodic
motion and its measured sub-`1e-7` carrier seam. Roller spin can accumulate because
the crowns are rotationally symmetric. Provenance accompanies the compressed
asset in `src/simulation/baked/assets/147.provenance.json`.
