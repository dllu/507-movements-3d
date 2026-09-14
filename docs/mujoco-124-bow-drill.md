# Movement 124: bow drill with native cord friction

The catalog's movement 124 uses a passive spindle driven by friction against
96 rotating cord sections in MuJoCo. Only the bow is actuated. A four-second
cycle completes the forward and return strokes. Section view exposes the wrap;
the engraved shaft-end hatching rotates with the actual spindle.

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

Free-string width comes from 91 independent readings normal to the two free
spans. Each reading measures the distance between the centers of two separate
engraved outline bands; ambiguous stations are excluded. Median width is
4.3000 pixels, mean 4.3011 pixels and range 3.25–4.95 pixels. At 100 source
pixels per world unit, cord radius is 0.0215 and drum radius 0.357713852.
The cord centerline pitch radius is 0.379213852.

Projected triangle silhouettes give:

| Feature | Samples | RMS error, pixels | Maximum error, pixels |
| --- | ---: | ---: | ---: |
| Bow sides | 308 | 0.574697 | 4.350786 |
| Lower stock tip | 4 manual points | 1.483409 | 1.762372 |
| Upper stock tip | 5 manual points | 1.013763 | 1.670251 |
| Outer pulley | 166 | 0.850899 | 2.151377 |
| Rim | 180 | 0.559788 | 1.284048 |
| Hub | 146 | 0.765610 | 2.221239 |
| Shaft | 130 | 2.236002 | 3.708879 |
| Free cord centerline | 93 | 1.107028 | 1.930160 |
| Free cord outline bands | 182 | 1.105223 | 2.106673 |
| Lower binding, left edge | 19 | 2.732928 | 4.780487 |
| Upper binding, top edge | 14 | 1.890746 | 2.748039 |
| Upper binding, bottom edge | 10 | 0.900029 | 2.088085 |
| Lower loose end | 3 | 1.700198 | 2.031233 |
| Upper loose end | 5 | 0.736274 | 1.166285 |

The shaft error includes the engraving's off-center inner contour. Tip readings
are sparse. Binding readings select the first narrow exterior ink band on
bounded rays; 23 ambiguous rays are excluded. They qualify partial contours,
not a complete tracing of either knot. The 51 accepted readings and their
source overlay are retained separately from the geometry fit.

Binding handedness now follows the engraved stripes: rising from left to right
at the lower tie, falling at the upper tie. Each has three visible turns and a
continuous curved loose end. The lower coil uses 2.75 full windings to leave
room for that end. Its working string enters behind the stock, at depth -0.25
world unit; the upper string enters at +0.15. This inferred depth offset clears
the coil instead of forcing the free string through it. The curved lower lead
joins the free span and winding tangentially. Parallel-transport tube frames
avoid twist-induced mesh folds. Bound ties remain rigid geometric attachments,
not deformable simulated knots.

Entry and exit strands have different depths, with one nearly complete helical
turn joining tangent free spans. Initialization expands the sampled centerline
just enough that the actual finite section chords clear the drum; placing only
their vertices on the pitch circle caused initial penetration. Hidden flange
depths, bow inclination, shaft continuation and flat drill bit are reconstruction
assumptions. Ideal hand guidance and shaft bearings are represented by joints.
The shaft's material-only section lines reproduce the engraving and make its
rotation visible without adding a marker or changing inertia.

## Native model

Only the bow slide is actuated. The spindle has a passive axial hinge. A passive
spring slide at the lower attachment represents lumped bow compliance; the
visible stock follows that displacement with a smooth approximate deformation.
There is no prescribed spindle angle or output actuator.

The cord consists of 96 independent rigid capsules with full translation and
rotation. Ninety-five native ball connections join adjacent section ends; two
further connections pin the cord to the bow attachments. This avoids the dense
mass matrix of a long serial joint chain. Adjacent capsules are excluded from
self contact; other sections retain finite collision. Geometry that makes
nonadjacent sections overlap initially is rejected.

Each section has the mass and inertia of its cylindrical share of cord material.
Overlapping collision end caps do not add duplicate material mass. Bow and
spindle inertia come from their visible meshes. Uniform density is normalized
to unit bow mass; cord density defaults to that same value. Friction, damping,
tip spring, pretension and density are reconstructed, not measured materials.
Bending and torsional stiffness are omitted. Optional spindle `resistance`
uses native joint friction loss and defaults to zero; it supplies a resisting
load in either direction for validation.

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
| Default, 96 sections / 0.001 s | -2.426317 to +2.326230 | 0.050397 | 0.004889 | 0.002144 |
| Time refinement, 96 / 0.0005 s | -2.451124 to +2.301328 | 0.044174 | 0.004888 | 0.001484 |
| Spatial refinement, 128 / 0.001 s | -2.448741 to +2.311757 | 0.068640 | 0.006584 | 0.002093 |
| No friction, 96 / 0.001 s | approximately zero to +0.000000838 | 0.048053 | 0.001426 | 0.002776 |
| Native resistance 0.25, 96 / 0.001 s | -2.396891 to +2.350679 | 0.068459 | 0.004999 | 0.002267 |

Default peak-to-peak spindle travel is 4.752547 radians, within 0.125% of the
ideal pitch-radius estimate `1.8 / 0.379213852 = 4.746662`. Compliance and
initial seating shift the mean angle. Time refinement changes total travel by
about 0.000095 radian; spatial refinement changes it by about 0.007952 radian.
These trials support travel stability while retaining the changed mean angle
as a limitation. They do not establish exact pointwise trajectory convergence.

Native contact forces reproduce the spindle's constraint torque to within
`3.6e-15` across these trials, including the native resistance torque when
present. Default force-weighted RMS circumferential surface slip after the first
second is 0.003224 world unit/second. Omitting section rotation only from that
velocity diagnostic raises apparent slip to 0.056290. Removing friction in the
actual simulation reduces spindle drift below 0.000000839 radian over three
cycles. Maximum default bow tracking error is 0.358083 pixel.

The contact diagnostic uses MuJoCo's
[object velocities and contact forces](https://mujoco.readthedocs.io/en/stable/APIreference/APIfunctions.html#mj-objectvelocity)
with explicitly owned WASM output buffers. It compares velocities at the same
contact point, including angular velocity crossed with the point offset.
The comparison without rotation is a diagnostic, not a second physical model.
The loaded trial's sampled resistance work is -7.355283 in model units.
This 10 ms quadrature is an approximate diagnostic; small positive sampled
power near reversals does not establish an exact discrete energy balance.
The loaded trial checks a finite resisting torque, not arbitrary drilling loads.

## Geometry, clearance and playback

All 13 initial parts are closed, consistently oriented solids. A 51-pose audit
from zero to 12.5 seconds makes 8,826,664 queries against the actual rendered
triangle surfaces and finds zero unintended intersections. Intended working
contact reaches 0.014734 source pixel penetration. The four named attachment
end-cap joins overlap by at most 2.127117 pixels within their restricted join
regions. Rigid spindle assembly attachments are excluded. The audit includes
free cord against every other part and bound coils against the stock.

Independent segment-distance checks find at least 3.048012 source pixels
between nonadjacent default native cord sections; the 128-section refinement
retains 1.210997 pixels. Static bound-coil checks exclude only the contiguous
local bend and retain positive clearance between separate turns and loose ends.
Only the free cord, drum and flanges have native collision; other hardware uses
ideal guidance and independent rendered-surface validation. The clearance audit
samples surfaces and time and does not prove continuous collision freedom.
Its complete hardware result is for the default trajectory.

All sampled moving parts fit the conservative camera bounds; fog and ground
are disabled. Restart, seeking, frame partitioning, section toggling and native
allocation disposal have automated coverage. All 19 selected mechanism, shared
runtime, engine and camera tests pass. All eight final static views and 18
registered motion/catalog views are inspected, including both reversals,
third-cycle wrap, bindings, rear hardware and desktop/mobile controls.

Live headless playback advances the real viewer with its normal 50 ms frame
cap. It averages 28.34 fps over 12.0336 wall seconds while advancing 11.6160
physical seconds (96.53% speed). Mean update time is 18.936 ms and the 95th
percentile is 30.100 ms. There are no page errors; warnings are the existing
Three.js deprecations and screenshot readback notices. The production build
passes with the existing large-chunk warning.

The full 40-case production browser sweep passes 39 cases, including 124;
123 exceeds its five-second canvas-startup deadline. Its assets return HTTP 200
and the trace places completed assembly about ten seconds after navigation.
Three isolated checks with the original deadline give two passes and one
startup timeout. Giving 123 the existing 15-second heavy-model allowance then
passes all six focused checks: three each for 123 and 124. No 123 implementation
changes are needed. The other 39 cases retain their original passing checks.
These cover lazy WASM loading beneath a static subdirectory, playback/pause,
restart, section views, speed, mobile controls, navigation, retry and disposal.

## Reproduction and local artifacts

```sh
TMPDIR=/dev/shm node scripts/measure-bow-drill-source.mjs
TMPDIR=/dev/shm node scripts/fit-bow-drill-source.mjs
TMPDIR=/dev/shm SOURCE_REPORT=/dev/shm/124-source.json node scripts/measure-bow-drill-cord-width.mjs
TMPDIR=/dev/shm node scripts/measure-bow-drill-bindings.mjs
TMPDIR=/dev/shm WIDTH_REPORT=/dev/shm/124-cord-width.json BINDING_REPORT=/dev/shm/124-bindings.json node scripts/compare-bow-drill-source.mjs
TMPDIR=/dev/shm node scripts/probe-bow-drill-links.mjs
TMPDIR=/dev/shm node scripts/audit-bow-drill-clearances.mjs
TMPDIR=/dev/shm INTEGRATED=1 node scripts/capture-bow-drill-motion.mjs
TMPDIR=/dev/shm node --test tests/mujoco-bow-drill.test.mjs
```

Outputs are exclusive: use a new `PROBE_PREFIX` on each repeat. `SOURCE_REPORT`,
`WIDTH_REPORT` and `BINDING_REPORT` select input measurements. `SIM_OPTIONS` is
JSON for native trial options. Browser scripts use `PROBE_BASE_URL` with a local
Vite server. `capture-bow-drill-baseline.mjs` invokes the old factory explicitly;
`capture-bow-drill-motion.mjs` uses the registered factory with `INTEGRATED=1`.
Its runtime check advances the actual viewer with its 50 ms frame-delta cap.

Local evidence includes `/dev/shm/124-source-c`, `124-cord-width-a`,
`124-bindings-a`, `124-source-comparison-e`, `124-clearances-f`,
`124-links-final-b`, `124-links-time-b`, `124-links-space-b`,
`124-links-no-friction-b`, `124-links-loaded-a` and `124-geometry-views-e`.
Final integration evidence is in `124-integrated-motion-a`,
`124-integrated-tests-a.log`, `124-integrated-build-a` and
`124-integration-evidence-a.json`. Browser logs are `124-e2e-a.log` (full sweep),
`124-e2e-c.log` (original-deadline isolation) and `124-e2e-d.log` (six passing
focused checks). `124-completion-evidence-a.json` records final hashes and the
test-only startup allowance change. The integration evidence file preserves the inspection
record and verifies every numerical archive against the final sources:
post-study differences are restricted to comments, reconstruction notes/status
and exposing the existing lower-tie depth in inspection metadata. Geometry
positions and native dynamics are unchanged. Scripts snapshot and hash their
inputs; bulk trajectories and images stay outside Git. These are local review
artifacts, not portable assets.

Historical failures are retained. The cable plugin is absent from the pinned
WASM build. A 144-link serial ball-joint cable was stopped after 589 seconds of
CPU without completing its request; achieved physical time was not logged.
Early flex trials stretched or lost the wrap. The old stable flex candidate
produced about 5.18 radians of spindle travel, exposing its missing section
rotation. Initial free-section trials with multiple contacts reset repeatedly;
so did the thinner cord at 0.002-second steps. Failed reports explicitly record
resets. The probe stops on the first reset and exits unsuccessfully while
retaining its failed report. Earlier binding shapes folded their tube surfaces
or intersected the entering strand; the corrected curves and rear entry pass
the final checks above.
