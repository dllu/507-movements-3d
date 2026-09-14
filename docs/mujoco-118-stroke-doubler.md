# 118 — Traveling pinion doubles a stroke

The catalog uses `src/simulation/mujoco-stroke-doubler/`. A translating
pitman carries a loose pinion between a fixed lower rack and a passive
upper rack. Only the pitman is actuated; native tooth contact determines
the pinion angle and upper rack position. This replaces prescribed output
motion, a sixteen-tooth pinion, mismatched rack teeth, an oversized upper
rail and invented frame posts. The complete reversing cycle takes five
seconds. Ground and fog are disabled and the camera fits the full stroke.

## Source reconstruction

Brown's [engraving and caption](https://507movements.com/mm_118.html) specify
that the lower rack is fixed and the upper rack travels twice as far as
the spindle carried by the pitman. The model retains the visible fourteen
pinion teeth, nineteen upper rack teeth, twenty lower rack teeth, sloping
pitman and rounded base outline.

Measurements use bounded ink midpoints at threshold 110, with 100 source
pixels per world unit. The pitman-eye center is (257.19208, 247.65561)
pixels, its radius 16.00084 pixels and the pin radius 5.40839 pixels.
Independent straight-line fits determine the rail, base and pitman edges.
The rack direction is regularized to a common 0.00942979-radian tilt.
The pitman retains its measured outline and a raised circular eye.

The pinion and racks share a generated involute system with module
6.68 pixels, reference radius 46.76 pixels, circular pitch 20.98584 pixels
and a 20-degree pressure angle. Addendum is 0.8 module, dedendum 1 module
and cutter corners 0.08 module. Rack radial clearance is 0.1 pixel;
the generated gear also has the shared cutter's small backlash and radial
clearance. Initial pinion phase is 0.21651043 radians relative to the rack
axes. Upper and lower tooth origins are −198.99658 and −199.73436 pixels
relative to the spindle, ensuring a compatible initial mesh on both sides.

The drawing's rack spacing varies: independent linear fits give pitches
20.87328 and 20.90756 pixels, with several-pixel residuals. A combined
radial-contour and rack-center score slightly favors fifteen pinion teeth,
but that conflicts with the visible fourteen-tooth outline. The selected
fourteen-tooth candidate preserves the source count. Distances to actual
rendered edges are smaller than radial-ray residuals at the steep flanks.
Regular spacing cannot exactly reproduce the engraving's individual teeth.

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Pinion | 68 | 1.90085 | 6.41240 |
| Pitman eye | 80 | 0.77041 | 1.43517 |
| Spindle pin | 50 | 0.82005 | 1.59645 |
| Upper rail top | 225 | 0.82589 | 1.89488 |
| Upper rack root edge | 79 | 3.03867 | 6.92987 |
| Fixed rack underside | 209 | 0.51713 | 1.50905 |
| Bed top / bottom | 241 / 197 | 0.44513 / 0.45184 | 1.50560 / 1.32040 |
| Pitman top / bottom | 87 / 33 | 0.28890 / 0.21407 | 0.72876 / 0.67791 |
| Upper / lower tooth centers | 20 / 21 | 5.83058 / 4.00544 | 10.40051 / 7.74575 |

Gear readings exclude merged rack ink and the pitman overlap. The tooth
center rows contain repeated readings from clear, bounded windows rather
than every tooth. Frame corner curves, the pitman's broken left end and
the three rounded forms below the fixed rack are reconstructed from their
visible outlines. Their complete contours are reviewed in the overlay but
are not independently fitted in the table. The three forms are interpreted
as static support webs; the caption assigns them no independent motion.
Hidden depth, ideal bearings and translation guides are inferred.

## Native motion and limits

Three coordinates represent pitman translation, the pinion's hinge on its
spindle and upper rack translation. There is one position actuator, no
equality constraint and no tendon. Output coordinates are never overwritten.
If pitman displacement is `x`, the fixed lower rack imposes `x + Rθ = 0`.
The upper contact then imposes `X = x − Rθ = 2x`. Native contact enforces
this relation with finite backlash and compliance.

The input has a 0.9-world-unit sinusoidal amplitude and a 0.25-second smooth
startup. Its stroke and timing are illustrative: the engraving shows no
complete crank or piston. The pitman translates at its fixed source angle,
representing a driven carrier with an offscreen guide; it does not simulate
an unseen crank linkage. Both rack orientations, the carrier's path and
the spindle bearing are ideal constraints.

Ten closed solids define the visible hardware. Mass and full inertia are
integrated from moving solids at a uniform density normalized to upper
rack mass 1. The pinion has a finite bore with 0.1 pixel radial clearance
around the nonrotating carrier spindle. The raised eye, pitman plate and
spindle meet at welded boundaries with disjoint interiors. Bearing contact
is not used to establish the ideal hinge.

The default uses frictionless tooth contact, gravity, 0.5 ms steps, 2 ms
contact response, discrete integration, exact constraint inertia and Newton
solving. Its 467 convex collision cells comprise 376 pinion, 20 upper-rack
and 71 lower-rack cells. All 7,830 compiled vertices agree with the visible
geometry within 0.00001165 source pixel. Only working teeth participate in
native contact; the remaining hardware is independently audited.

Ten cycles (50 native seconds) retain an upper rack range from −1.80268505
to +1.80272833 world units. Maximum doubled-stroke error is 0.14423049 source
pixel, lower rolling error 0.07702345 pixel, native penetration 0.00969098
pixel and input tracking error 0.447694 pixel. There are no automatic resets.
The finite output error includes the deliberately retained mesh clearance;
it is not hidden by visual smoothing or an exact ratio constraint.

| Two-cycle sensitivity trial | Maximum stroke error, pixels | Maximum penetration, pixels |
| --- | ---: | ---: |
| 0.25 ms timestep | 0.144403 | 0.005694 |
| 192 gear samples, 4,096 cutter steps | 0.140889 | 0.007178 |
| Friction 0.1, constant upper-rack load +1 | 0.149647 | 0.011784 |
| Friction 0.3, constant upper-rack load −1 | 0.145511 | 0.007360 |

These trials retain the stroke in both directions. The loads use the
model's normalized units; material friction, physical scale and force
convergence are not calibrated. Removing all contacts leaves the pinion
and upper rack stationary while the carrier still moves. Removing only the
upper contact leaves the pinion rolling on the lower rack but the upper
rack stationary. Removing the lower contact gives only 0.19319 units of
upper-rack motion for 0.90012 units of carrier motion at the quarter cycle,
demonstrating that both contacts are necessary for the doubled stroke.

The independent 21-pose surface audit makes 1,517,922 vertex, edge-midpoint
and triangle-centroid queries across the full hardware and checks camera
bounds. Maximum sampled working-contact penetration is 0.00105252 pixel;
no unintended intersections are found. Only the working tooth regions
allow soft penetration. Spindle bore, pitman, rack bodies and static
supports receive no contact allowance. This sampled audit does not certify
continuous interference or replace the larger all-step native maximum.

Six mechanism tests and nine shared engine/runtime tests pass. They cover
closed solids, compiled collision geometry, passive stroke transmission,
contact removal, exact restart and backward seeking, frame partitioning
and native allocation disposal.

All thirteen final catalog views are inspected, including the source overlay,
both stroke limits, return, both tooth contacts, pitman eye, rear and axial
views. The full mechanism stays in frame through the stroke. A same-pose
shadow comparison identified front-face specks; increasing this mechanism's
shadow normal bias from 0.003 to 0.01 removes them while retaining part
shadows. This changes rendering only.

Final headless playback averages 60.07 frames per second over 12.0194 wall
seconds and advances 12.016 native seconds (99.97% of real time). There are
no page errors. Existing Three.js clock/shadow-map deprecations and screenshot
readback notices remain. The production build and all 34 MuJoCo browser
checks pass. After the final shadow adjustment, the production build and
118's static-subdirectory loading, playback and restart check pass again.
The full suite precedes that final display-only adjustment.

## Reproduction and evidence

Bulk evidence remains outside Git. Reports archive inputs and record hashes.
The decisive `/dev/shm/118-` prefixes are:

- `baseline-a`: seven inspected views of the replaced implementation.
- `source-a`, `source-point-review-a`, `fit-a`: measurements and candidate fits.
- `comparison-b`: rendered-edge distances at the native initial pose.
- `dynamics-d`: ten-cycle final construction; `e` through `h`: sensitivity trials.
- `clearances-b`: independent audit of all ten solids.
- `tests-b.log`, `build-a.log`, `browser-a.log`: numerical tests and full browser suite.
- `build-b.log`, `browser-c.log`: final rebuild and targeted browser check.
- `shadows-b`: five same-pose shadow comparisons; normal bias 0.01 is selected.
- `integrated-b`, `integrated-b-inspection`: final registered catalog views and review.
- `integrated-final-review-a.json`: evidence hashes and input compatibility.

The preliminary candidate, comparison and native studies predate the raised
pitman eye and final camera/shadow adjustment. Final numerical studies
predate only the display-status change, catalog registration and final shadow
setting; their physical geometry and physics are unchanged. The first targeted
browser invocation (`browser-b.log`) matched no tests because of an anchored
filter; the corrected invocation is retained in `browser-c.log`.
The all-507 review remains active.

```sh
PROBE_PREFIX=/dev/shm/118-new-source node scripts/measure-stroke-doubler-source.mjs
TMPDIR=/dev/shm SOURCE_REPORT=/dev/shm/118-new-source.json PROBE_PREFIX=/dev/shm/118-new-comparison node scripts/compare-stroke-doubler-source.mjs
TMPDIR=/dev/shm DURATION=50 PROBE_PREFIX=/dev/shm/118-new-dynamics node scripts/probe-stroke-doubler-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/118-new-clearances node scripts/audit-stroke-doubler-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-stroke-doubler.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/118-new-views node scripts/capture-stroke-doubler-candidate.mjs
```
