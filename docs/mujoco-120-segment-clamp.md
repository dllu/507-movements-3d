# 120 — Compound pinions close opposed segment jaws

The catalog uses `src/simulation/mujoco-segment-clamp/`. One reversing shaft
drives both jaws through native external and internal gear contact. Contact
between the gripping edges stops closure; neither jaw angle is prescribed.
The replacement restores the engraving's curved jaws, enclosing frame,
shaft positions and initial gear phase. It uses compatible involute teeth,
ideal bearings and explicitly reconstructed depths. A smooth five-second
cycle closes and reopens the clamp. Ground and fog are disabled, and the
camera contains the complete stroke.

## Source reconstruction

Brown's [engraving and caption](https://507movements.com/mm_120.html) specify
one externally toothed segment, one internally toothed segment and two
pinions on a common shaft. Each segment carries a jaw. The old animation
used equal 1:3 jaw ratios, nearly triangular rack teeth, altered jaw curves
and an invented rear spine/base.

Independent ink measurements locate the common jaw pivot at
`(254.304738, 213.504430)` and the input shaft at
`(273.920030, 396.279124)` in the 525-pixel source. Their separation is
183.824232 pixels, with 100 source pixels per world unit. The measured
pivot pin, hub and eye radii are 10.933286, 20.514643 and 32.656634 pixels;
the input shaft radius is 18.410313 pixels. Separate spline curves follow
the inner and outer jaw and frame outlines.

The clearly visible small-pinion tip spacing favors 13 teeth. The larger,
partly occluded pinion is interpreted as 23 teeth. Compatible complete
gear counts for the segments are 51 external and 79 internal, giving
modules of 5.744507 and 6.565151 source pixels. The two pairs share their
measured center distance but have different modules and ratios:

```text
external jaw angle = −13/51 × input angle
internal jaw angle = +23/79 × input angle
```

These expressions measure rolling error; they do not drive the simulation.
The regularized teeth use 20-degree pressure angles, 0.8-module addendum
and 1-module dedendum. External profiles use the shared rounded rack cutter,
0.12-module cutter corners, 96 samples per tooth and 2,048 cutter steps.
Internal flanks use the corresponding involute angular thickness with
0.008-module backlash. Initial small and large pinion phases are
0.226557163 and 0.231832872 radians. Segment phases follow conjugate mesh
alignment about the measured line of centers.

The fit is a source interpretation, not an exact tooth tracing. A 12/45
external pair has a slightly better combined nearest-edge score than
13/51, but fits the small pinion's clear tip spacing worse. The selected
23/79 internal pair gives the best edge score among the compared source
count candidates. The engraving's lower rim is not a circle concentric
with the pivot; its outer outline is retained while the working teeth are
regularized about the actual pivot.

Independent ink points compared with slices through actual rendered
triangles give the following source-pose distances:

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Small pinion | 454 | 1.92209 | 6.41362 |
| Large pinion | 315 | 4.46834 | 9.09023 |
| External segment | 139 | 3.32959 | 8.81162 |
| Internal segment | 44 | 4.83488 | 10.33917 |
| Outer frame rim | 105 | 1.32087 | 2.29213 |
| Pivot pin | 65 | 0.35153 | 0.97606 |
| Pivot hub | 86 | 0.99134 | 2.22343 |
| Pivot eye / jaw junction | 69 | 2.51939 | 10.07858 |
| Input shaft | 88 | 0.49556 | 1.18550 |

The large/internal teeth require visible local corrections of up to about
ten source pixels. The overlay records those differences rather than
concealing them with separate registrations.

## Reconstructed hardware and contact

Twelve closed solids form the jaws, frames, pinions, shaft, hub and pivot
hardware. The enclosing frame arms lie behind the large pinion, leaving
0.06 world units of axial clearance. Its working tooth band is raised to
the large pinion's plane. The external segment and small pinion occupy a
second plane. Widened gripping edges bridge these planes so that the jaws
can physically meet. These depths and steps are inferred from the mechanism,
not measurable in the single engraving. The two visible jaw tips have
different pivot radii: the left tip meets the right inner edge slightly
behind the right tip.

A coplanar trial jammed the large pinion against a frame arm before the
jaws met. Recessing the arm exposed a second jam at an incomplete end tooth.
The raised internal segment now ends at complete tooth spaces, near
−119.386 and −60.145 degrees. Both failed trials and their actual contact
witnesses remain in the evidence archive.

Three ideal hinge coordinates represent the compound shaft and two jaws.
There is one torque-limited position actuator on the input and no equality
constraint or tendon. The smooth input target is
`1.9 × (1 − cos(2πt/5)) / 2`, with a small velocity lead. Its normalized
torque limit is 8. The input stalls naturally when the jaws meet and reverses
as the target returns. The repeating drive is an animation assumption;
the source does not specify a driving crank or motor. Passive jaw positions
and velocities are never overwritten during stepping.

The solver uses gravity, frictionless contact, 1 ms steps, 2 ms contact
response, discrete integration and Newton solving. Visible-solid full
inertias use uniform density normalized to internal-jaw family mass 1.
Mass, material friction, physical scale and clamp forces are not calibrated.

Native collision uses 673 convex cells covering the working teeth and
gripping edges. Their boundaries are simplified from actual rendered cap
edges with a maximum removed-vertex chord distance of 0.05 source pixel.
The measured maximum is 0.04984512 pixel; all 5,422 compiled vertices agree
with their collision-cell inputs within 0.00000217 pixel. Visible geometry
is unchanged. A separate full-hardware surface audit checks
the omitted arms, shaft and pivot surfaces. The approximation bound and
compiled vertex check do not themselves certify continuous clearance.

## Validation

Ten complete cycles (50 native seconds) retain both gear meshes and jaw
contact without resets. Input travel is −0.00447951 to 1.69605257 radians;
external jaw travel is −0.43173449 to 0.00163725, and internal jaw travel is
−0.00148456 to 0.49371151. Maximum pitch-circle rolling error is
0.12143107 source pixel; maximum native contact penetration is 0.03146827.

| Two-cycle sensitivity trial | Rolling error, pixels | Native penetration, pixels |
| --- | ---: | ---: |
| 0.5 ms timestep | 0.120870 | 0.034269 |
| 0.025-pixel collision tolerance | 0.084945 | 0.045403 |
| 192 gear samples, 4,096 cutter steps | 0.116706 | 0.045033 |
| Friction 0.1, opposed jaw loads ±1 | 0.120963 | 0.029946 |
| Friction 0.3, reversed jaw loads ∓1 | 0.118059 | 0.029984 |

All trials close, reopen and retain engagement. A higher-precision reference
with 0.005-pixel collision tolerance and 0.5 ms steps gives rolling error
0.064726 pixel and penetration 0.030657 pixel, but runs substantially slower
in the browser. These comparisons qualify the displayed motion under the
tested assumptions; they are not a force-convergence study.

The independent audit checks all twelve solids at 21 poses through a cycle,
making 4,219,514 bidirectional vertex, edge-midpoint and triangle-centroid
queries. It finds no unintended intersections and verifies camera bounds.
Maximum sampled working-surface penetration is 0.04262602 source pixel.
Only tooth and gripping regions receive a 0.05-pixel soft-contact allowance.
Sampling does not prove continuous clearance.

Six mechanism tests and nine shared engine/runtime tests pass. They cover
closed solids, collision compilation and approximation, independent tooth
driving, two-cycle jaw contact, removing the closing stop by disabling jaw
contact, exact restart, backward seeking, frame partitioning and disposal.
Disabling either pinion's contact leaves its own jaw stationary in zero
gravity while the other pair still drives; disabling both leaves both jaws
stationary while the shaft turns.

All fourteen final catalog views are inspected, including the registered
source overlay, both gear meshes, jaw contact, pivot, rear and axial views.
No page errors occur. Headless Chrome averages 37.09 frames per second over
12.0255 wall seconds, advancing 12.016 native seconds (99.92% of real time).
Existing Three.js clock/shadow-map deprecations and screenshot readback
notices remain. The production build succeeds with its existing large-chunk
warning. All 36 MuJoCo browser checks pass, including loading beneath a
static subdirectory, playback and restart for 120.

## Reproduction and evidence

Bulk reports and captured images remain outside Git under `/dev/shm/120-`,
with exclusive output files and archived input hashes:

- `baseline-a`: seven inspected views of the replaced animation.
- `source-c`: corrected independent readings and inspected point overlay.
- `fit-a`, `assembly-fit-c`, `edge-fit-a`: tooth-count and compatible-pair fits.
- `comparison-b`: distances to final rendered triangle edges.
- `dynamics-a` through `c`, `stall-a`, `stall-b`: failed early constructions.
- `dynamics-d`, `e`: precision/performance comparisons before registration.
- `dynamics-f`: ten final cycles; `g` through `k`: sensitivity trials.
- `clearances-c`: final full-hardware surface audit.
- `tests-b.log`, `build-a.log`, `browser-a.log`: final tests, build and browser suite.
- `integrated-a`, `integrated-a-inspection`: final registered catalog views.
- `integrated-final-review-a`: final evidence hashes and source verification.

Earlier source readings could pick up an underlying pinion or an inner
frame edge. Source `c` uses the first encountered ink run in the external
tooth window, discarding clipped or merged runs instead of falling through
to unrelated ink. Capture `a` shows the original frame jam; `b` has the
correct physical geometry at excessive collision precision; `c` has the
final effective performance settings before registration. The all-507
review remains active.

Use a fresh prefix for each run and keep its inputs unchanged until it ends.
Captures use the existing Vite server at `http://127.0.0.1:5174` and one
owned browser at a time.

```sh
PROBE_PREFIX=/dev/shm/120-new-source node scripts/measure-segment-clamp-source.mjs
TMPDIR=/dev/shm SOURCE_REPORT=/dev/shm/120-new-source.json PROBE_PREFIX=/dev/shm/120-new-comparison node scripts/compare-segment-clamp-source.mjs
TMPDIR=/dev/shm DURATION=50 PROBE_PREFIX=/dev/shm/120-new-dynamics node scripts/probe-segment-clamp-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/120-new-clearances node scripts/audit-segment-clamp-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-segment-clamp.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/120-new-views node scripts/capture-segment-clamp-candidate.mjs
```
