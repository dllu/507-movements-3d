# Movement 124: finite-cord reconstruction candidate

This is an **unregistered review candidate**, not a verified replacement for
movement 124. The existing public factory remains in use. The new candidate
uses MuJoCo cord contact to drive a passive spindle and retains the engraving's
bow, string and pulley proportions. Complete hardware clearance, transmission
accuracy and source-detail qualification remain open.

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

The final static candidate's projected triangle silhouettes give:

| Feature | Samples | RMS error, pixels | Maximum error, pixels |
| --- | ---: | ---: | ---: |
| Bow sides | 308 | 0.574220 | 4.350633 |
| Lower stock tip | 4 manual points | 1.483405 | 1.762365 |
| Upper stock tip | 5 manual points | 1.003339 | 1.655391 |
| Outer pulley | 166 | 0.850899 | 2.151377 |
| Rim | 180 | 0.559788 | 1.284048 |
| Hub | 146 | 0.765610 | 2.221239 |
| Shaft | 130 | 2.236002 | 3.708879 |
| Free cord centerline | 93 | 1.092679 | 1.876690 |

The shaft error includes the engraving's off-center inner contour. The knot
contours have not been measured completely; the lower wrap is visibly higher
than the engraved binding and needs refinement. Tip measurements are sparse,
so their small residuals alone do not establish a full silhouette match.

One world unit is 100 source pixels. The inferred cord radius is 3.108516
pixels, taken from half the outer/rim radius difference; the inferred drum
radius is 34.812870 pixels. This interpretation still needs checking against
the actual free-string width. Entry and exit strands have different depths,
with one nearly complete helical turn joining tangent free spans. The hidden
flange depths, inclined bow, shaft continuation and flat drill bit are
reconstruction assumptions. Rounded solid leads represent tied attachment
regions; their overlap with the binding is intentional, not separately
simulated knot topology.

## Native model and limitations

Only the bow's slide is actuated. The spindle has a passive axial hinge. A
passive spring slide at the lower attachment represents lumped bow compliance;
the visible stock follows that displacement with a smooth approximate
deformation. The string endpoints follow the native attachment positions.
There is no prescribed spindle angle, rolling equality or output actuator.

The cord uses MuJoCo's [one-dimensional flex elements and edge-length
constraints](https://mujoco.readthedocs.io/en/stable/XMLreference.html#deformable-flex):
96 finite capsules between translational particles, with friction and native
self contact. The shared MuJoCo loader, allocation ownership and fixed-step
playback are reused. The normal timestep is 0.002 seconds, the input period
four seconds and amplitude 0.9 world unit. The spindle inertia comes from its
visible geometry. Uniform density is normalized to unit bow mass; the cord
uses the same density by default. These are reconstruction values, not
measured materials. The tip spring, pretension, friction and damping likewise
need physical interpretation.

This flex formulation has no cross-section rotation or bending stiffness.
Consequently, its contact-surface speed need not equal the usual centerline
pitch-radius rolling formula for a thick cord. The roughly nine-percent
difference between drum and cord-center radii makes this a material open
question, not a negligible implementation detail. A full transmission and
contact-velocity audit is required before registration.

The native model currently collides the cord with the drum and both flanges.
It does not yet collide the entire visible stock, bindings, shaft and bit.
The ideal hand guide and shaft bearing are not drawn as invented supports.
All 13 visible components are closed, consistently oriented meshes at rest;
the moving cord also passes this audit at three sampled poses. This does not
prove absence of inter-part penetration.

## Evidence and unresolved work

The default 12.25-second native trial spans three complete cycles. Spindle
angle ranges from -2.609967 to +2.571535 radians; maximum penetration is
0.095821 pixel, maximum edge strain 0.0012081, and maximum bow input error
0.523765 pixel. There are no time resets or nonfinite states, and spindle
actuator force remains zero.

A combined refinement to 108 cord elements and 0.001-second steps also
completes three cycles. Penetration falls to 0.058656 pixel and maximum edge
strain to 0.0008218. Its angle range is -2.609753 to +2.575776 radians. This
combined trial supports stability but does not separate spatial and temporal
convergence.

Frictionless contact leaves only a small numerical drift. Tightening the
[convex collision tolerance](https://mujoco.readthedocs.io/en/stable/XMLreference.html#option-ccd-tolerance)
from `1e-6` to `1e-10` reduces the one-second drift from 0.001871 radians to
0.000003411 radians. Over 12.25 seconds at the tighter setting the largest
absolute frictionless angle is 0.000153841 radians. This residual is recorded;
the regression does not assert mathematically exact zero rotation.

Six targeted tests cover solid geometry, actuator/constraint topology,
three-cycle transmission, friction removal, attachment synchronization,
seeking/restart and disposal. A mesh finer than the local self-contact rule
permits is rejected, because nonadjacent short capsules otherwise start
overlapped. Native motion captures include source overlays, both reversal
positions, rear and oblique views, attachment details and exposed cord wraps.
The development-server browser trial averages 49.90 fps over 8.0164 wall
seconds, advancing 8.0160 physical seconds. Production integration and its
browser checks remain pending.

Before registration: measure the complete binding contours and free-cord
width; resolve finite-cord rolling accuracy; refine the knot placement and
appearance; check all hardware and self clearances over motion; separate
spatial/time convergence and loaded trials; establish camera bounds from
the final trajectory; and make spindle rotation readable in the default view.

## Reproduction and local artifacts

Run source measurement, fitting and silhouette comparison in that order:

```sh
TMPDIR=/dev/shm node scripts/measure-bow-drill-source.mjs
TMPDIR=/dev/shm node scripts/fit-bow-drill-source.mjs
TMPDIR=/dev/shm node scripts/compare-bow-drill-source.mjs
TMPDIR=/dev/shm node scripts/probe-bow-drill-flex.mjs
TMPDIR=/dev/shm node --test tests/mujoco-bow-drill.test.mjs
```

Outputs are exclusive: use a new `PROBE_PREFIX` on each repeat, and supply
`SOURCE_REPORT` when changing the measurement filename. Browser scripts use
`PROBE_BASE_URL` (default `http://127.0.0.1:43928`) with a local Vite server.
`capture-bow-drill-baseline.mjs` invokes the old factory explicitly;
`capture-bow-drill-motion.mjs` invokes the unregistered native candidate.

Local evidence prefixes include `/dev/shm/124-source-c`, `124-fit-a`,
`124-source-comparison-b`, `124-flex-e`, `124-flex-fine-a`,
`124-flex-no-friction-b`, `124-motion-b` and `124-tests-c.log`.
Scripts snapshot and hash their inputs; bulk trajectories and screenshots
stay outside Git. These paths are local review evidence, not portable assets.

Earlier failed trials are retained: the cable plugin is absent from the
pinned WASM build; a 144-link serial ball-joint cable was deliberately stopped
after 589 seconds of CPU without completing its 8.25-second request. Its
achieved simulation time was not logged, so no physical result is inferred.
Early flex trials with very low cord density and insufficiently separated
elements stretched or lost the wrap. The current model uses visible mass,
suitable element spacing and tighter edge constraints. Early attachment
sweeps with folded surfaces were replaced; the final solid audit detects no
reversed normals or degenerate faces.
