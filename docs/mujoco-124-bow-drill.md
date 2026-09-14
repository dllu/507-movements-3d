# Movement 124: finite-cord reconstruction candidate

This is an **unregistered review candidate**. The public movement 124 still
uses its previous factory. The candidate reconstructs the measured bow and
pulley and drives a passive spindle with native MuJoCo cord friction. Complete
hardware clearance, knot detail and default rotation readability remain open.

## Source reconstruction

[Brown's engraving and description](https://507movements.com/mm_124.html) show
a reciprocating bow with its string wound around the drill pulley. The previous
factory prescribed the spindle angle, drew a coincident planar wrap, enlarged
the pulley, and added a grip, frame and markers absent from the engraving.

Independent bounded ink readings give 154 paired bow-outline stations, 93 free
string centers and four approximately circular contours. The bow centerline is
fitted in its chord coordinates with
`4 s (1-s) [a + b (2s-1) + c (2s-1)^2]`; its width varies quadratically.
The pulley circles are regularized to a common axis at source pixel
`(305.764405, 306.505971)`. Their outer, rim, hub and shaft radii are
44.138416, 37.921385, 27.388401 and 15.408038 pixels.

Free-string width now comes from 91 independent readings normal to the two
free spans. Each reading measures the distance between the centers of two
separate engraved outline bands; ambiguous stations are excluded. Median
width is 4.3000 pixels, mean 4.3011 pixels and range 3.25–4.95 pixels. This
replaces the earlier width inferred from the pulley rim spacing. At 100 source
pixels per world unit, cord radius is 0.0215 and drum radius 0.357713852.
The cord centerline pitch radius remains 0.379213852.

Projected triangle silhouettes give:

| Feature | Samples | RMS error, pixels | Maximum error, pixels |
| --- | ---: | ---: | ---: |
| Bow sides | 308 | 0.574220 | 4.350633 |
| Lower stock tip | 4 manual points | 1.483405 | 1.762365 |
| Upper stock tip | 5 manual points | 1.003339 | 1.655391 |
| Outer pulley | 166 | 0.850899 | 2.151377 |
| Rim | 180 | 0.559788 | 1.284048 |
| Hub | 146 | 0.765610 | 2.221239 |
| Shaft | 130 | 2.236002 | 3.708879 |
| Free cord centerline | 93 | 1.107028 | 1.930160 |
| Free cord outline bands | 182 | 1.105678 | 2.116501 |

The shaft error includes the engraving's off-center inner contour. Tip readings
are sparse and knot contours are not yet fully qualified. The lower binding
has been moved down the stock; its attachment lead now meets the closest coil
section. A trial stock-tip shift worsened its measured silhouette and was
rejected. Both bindings still need detailed knot topology, including the small
loose end at the upper attachment.

Entry and exit strands have different depths, with one nearly complete
helical turn joining tangent free spans. Initialization expands the sampled
centerline just enough that the actual finite section chords clear the drum;
placing only their vertices on the pitch circle caused initial penetration.
Hidden flange depths, bow inclination, shaft continuation and flat drill bit
are reconstruction assumptions. Rounded leads overlap the binding at the tied
attachment; these regions do not simulate a deformable knot.

## Native model

Only the bow slide is actuated. The spindle has a passive axial hinge. A
passive spring slide at the lower attachment represents lumped bow compliance;
the visible stock follows that displacement with a smooth approximate
deformation. There is no prescribed spindle angle or output actuator.

The cord now consists of 96 independent rigid capsules with full translation
and rotation. Ninety-five native ball connections join adjacent section ends;
two further connections pin the cord to the bow attachments. This avoids the
dense mass matrix of a long serial joint chain. Adjacent capsules are excluded
from self contact; other sections retain finite collision. Geometry that makes
nonadjacent sections overlap initially is rejected.

Each section has the mass and inertia of its cylindrical share of cord
material. Overlapping collision end caps do not add duplicate material mass.
The bow and spindle inertia come from their visible meshes. Uniform density
is normalized to unit bow mass; cord density defaults to that same value.
These values, friction, damping, tip spring and pretension are reconstructed,
not measured materials. Bending and torsional stiffness are omitted.

Default timestep is 0.001 second, period four seconds and bow amplitude 0.9
world unit. `implicitfast`, native convex collision tolerance `1e-10` and a
single contact point per convex pair are used. Enabling multiple CCD points
produced redundant constraints and unstable trials. A 0.002-second timestep
also failed for the measured thinner cord and is not the default.

The previous one-dimensional flex formulation remains available only as an
explicit ablation. Its translational vertices omit section rotation, creating
a material error in finite-cord contact-surface velocity and spindle travel.
The current model uses the shared MuJoCo loader, stepping and allocation
ownership. The visible tube joins average connected native endpoints within
the measured closure tolerance; it does not reposition the physics sections.

## Transmission evidence

All following trials complete 12.25 physical seconds with finite state, zero
resets and zero spindle actuator force. Contact/connection diagnostics sample
every 0.01 second; angle extrema and bow errors are checked every native step.

| Trial | Spindle angle range, radians | Max penetration, pixels | Max joint gap, pixels | Max pin gap, pixels |
| --- | --- | ---: | ---: | ---: |
| Default, 96 sections / 0.001 s | -2.423569 to +2.328915 | 0.049321 | 0.004883 | 0.002281 |
| Time refinement, 96 / 0.0005 s | -2.442378 to +2.310005 | 0.054447 | 0.004881 | 0.001428 |
| Spatial refinement, 128 / 0.001 s | -2.457490 to +2.303070 | 0.049731 | 0.006580 | 0.002013 |
| No friction, 96 / 0.001 s | -0.000002389 to approximately zero | 0.047309 | 0.001415 | 0.002781 |

Default peak-to-peak spindle travel is 4.752484 radians, close to the ideal
pitch-radius estimate `1.8 / 0.379213852 = 4.746662`. Compliance and initial
seating shift the mean angle. Time refinement changes total travel by about
0.0001 radian; spatial refinement changes it by about 0.0081 radian. These
separate trials support travel convergence, while the changed mean angle is
retained as a limitation. They do not establish exact pointwise trajectory
convergence or behavior under arbitrary drill loads.

Native contact forces reproduce the spindle's constraint torque to within
`1.8e-15`. The force-weighted RMS circumferential surface slip after the first
second is 0.003782 world unit/second. Omitting section rotation only from that
velocity diagnostic raises the apparent slip to 0.056679. Thus the finite
cross-section rotation is present and materially affects transmission. Removing
friction in the actual simulation reduces maximum spindle drift to
0.000002389 radian over three cycles. Maximum default bow tracking error is
0.361488 pixel.

The contact diagnostic uses MuJoCo's
[object velocities and contact forces](https://mujoco.readthedocs.io/en/stable/APIreference/APIfunctions.html#mj-objectvelocity)
with explicitly owned WASM output buffers. It compares velocities at the same
contact point, including angular velocity crossed with the point offset.
The comparison without rotation is a diagnostic, not a second physical model.

## Remaining qualification

Six targeted tests pass: closed geometry and clear initialization, native
actuator/constraint topology, three-cycle transmission and contact velocities,
friction removal, visible attachment synchronization, seeking/restart and
disposal. All 16 development motion captures have been inspected, including
both reversals, a third-cycle pose, exposed wraps and attachment details.
Playback averages 29.63 fps over 8.03288 wall seconds while advancing 8.03200
physical seconds. The production build passes, although the unregistered
candidate is not included in that build.

The native model currently collides the cord with the drum and both flanges.
It does not yet collide the entire visible stock, bindings, shaft and bit.
Ideal hand guidance and shaft bearings are not drawn as invented supports.
Closed, consistently oriented meshes do not by themselves establish absence
of inter-part penetration. A full moving hardware audit remains necessary.

Before registration: complete knot/source-detail corrections; check hardware
and self clearances over motion; run loaded trials; establish camera bounds
from the final trajectory; make spindle rotation readable in the default view;
and validate production integration and controls. Development-only candidate
checks are not production qualification.

## Reproduction and local artifacts

```sh
TMPDIR=/dev/shm node scripts/measure-bow-drill-source.mjs
TMPDIR=/dev/shm node scripts/fit-bow-drill-source.mjs
TMPDIR=/dev/shm SOURCE_REPORT=/dev/shm/124-source.json node scripts/measure-bow-drill-cord-width.mjs
TMPDIR=/dev/shm WIDTH_REPORT=/dev/shm/124-cord-width.json node scripts/compare-bow-drill-source.mjs
TMPDIR=/dev/shm node scripts/probe-bow-drill-links.mjs
TMPDIR=/dev/shm node --test tests/mujoco-bow-drill.test.mjs
```

Outputs are exclusive: use a new `PROBE_PREFIX` on each repeat. `SOURCE_REPORT`
and `WIDTH_REPORT` select input measurements. `SIM_OPTIONS` is JSON for native
trial options. Browser scripts use `PROBE_BASE_URL` (default
`http://127.0.0.1:43928`) with a local Vite server.
`capture-bow-drill-baseline.mjs` invokes the old factory explicitly;
`capture-bow-drill-motion.mjs` invokes the unregistered native candidate.

Local evidence includes `/dev/shm/124-source-c`, `124-cord-width-a`,
`124-source-comparison-d`, `124-links-final-a`, `124-links-time-a`,
`124-links-space-a`, `124-links-no-friction-a`, `124-tests-d.log`,
`124-motion-c` and `124-build-b`. Scripts snapshot and hash
their inputs; bulk trajectories and images stay outside Git. These are local
review artifacts, not portable assets.

Historical failures are retained. The cable plugin is absent from the pinned
WASM build. A 144-link serial ball-joint cable was stopped after 589 seconds of
CPU without completing its request; achieved physical time was not logged.
Early flex trials stretched or lost the wrap. The old stable flex candidate
produced about 5.18 radians of spindle travel, exposing its missing section
rotation. Initial free-section trials with multiple contacts reset repeatedly;
so did the thinner cord at 0.002-second steps. Failed reports explicitly record
resets. The updated probe now stops on the first reset and exits unsuccessfully
while retaining its failed report.
