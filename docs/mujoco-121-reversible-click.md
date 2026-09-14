# 121 — Reversible click on a rocking disk

The reconstruction is in `src/simulation/mujoco-reversible-click/`. A vertical
input rod rocks the disk through an ordinary pin. The disk carries a free
hinged click, which drives the coaxial cog through native tooth contact.
Throwing the click over brings its other end into use and reverses the feed.
The input repeats in three seconds. Ground and fog are disabled.

## Source and geometry

Brown's [engraving and caption](https://507movements.com/mm_121.html) describe
the reciprocating rod, disk-carried click, intermittent cog rotation and
reversal by throwing over the click. They do not dimension the mechanism or
show the rod's distant guide and the load on the output shaft.

The replaced animation prescribed both the cog angle and click lift. Its
working nose was an analytical point, with the visible click in another
plane. It also enlarged the hub, halved the shaft diameter and added supports
absent from the engraving. The reconstruction puts both finite working
surfaces in the same plane, restores the rod's broad eye and uses the
measured disk, hub, shaft and pin sizes.

Independent circle fits in the 525-pixel engraving give disk radius
193.46572, hub radius 47.04865, shaft radius 18.32176, click-pin radius
11.07400 and crank-pin radius 11.59786 pixels. The common axis follows the
outer hub at `(254.233400, 277.116290)`; pin centers follow their individual
measurements. Scale is 100 source pixels per world unit. The drawing's disk,
shaft, hub rings and cog are not exactly concentric. Their physical axes
are regularized, leaving visible differences of a few pixels.

The clear tooth-tip spacing supports 24 teeth. The reversible cog uses
almost radial working faces, 101-pixel root radius and 119.5-pixel tip
radius. Each flat tip occupies 0.48 tooth pitch; its two root endpoints span
0.52 pitch. Root spaces have circular bottoms. This is a click-driven cog,
so it is an exception to the general preference for involute mating gears:
the tested 20-degree involute flanks cammed the reversed click outward and
did not provide the required reverse drive. The radial profile also fits
the independently measured source edges better. Its dimensions and phase
are a mechanically compatible source interpretation, not a globally optimal
fit or an exact tracing of each irregular engraved tooth.

The click outline follows the engraved curves. Its short working nose is
narrowed from the initial 15-pixel interpretation to a rounded 7-pixel end,
allowing it to enter the space between actual solid teeth. The opposite,
long end is used after throwing over the click. This interpretation of the
caption works mechanically; the source does not explicitly illustrate that
second configuration. The selected reverse setup starts at 3.3 radians and
settles under gravity. Selecting it resets the simulation into that setup;
manual throwing-over is not animated.

Actual rendered triangle-edge comparisons against independent ink readings
give these source-pose distances:

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Cog | 598 | 4.61360 | 9.01039 |
| Disk | 118 | 2.94644 | 5.86002 |
| Hub | 120 | 0.37557 | 0.87581 |
| Hub ring | 120 | 2.46798 | 4.30999 |
| Shaft | 74 | 2.99503 | 4.71300 |
| Click pin | 98 | 0.30092 | 0.87975 |
| Crank pin | 118 | 0.50091 | 1.37766 |
| Rod eye | 86 | 1.32639 | 2.45537 |
| Left rod edge | 70 | 0.75973 | 1.27608 |
| Right rod edge | 70 | 1.47217 | 2.44337 |

The diagnostic involute version's cog RMS is 6.30324 pixels. A separate front
eye ring preserves the complete engraved circle where the stem joins the
rod; the first united outline omitted its upper arc.

## Constraints and reconstruction assumptions

Five native coordinates describe the disk, rod, click, cog and input slide.
Only the vertical slide is actuated. An ideal pin closes its connection to
the rod; the rod swivels about its disk pin. The click has no prescribed
angle, actuator or default spring. Its weight seats it against the teeth.
The cog has no position coupling to the disk. Removing tooth contact leaves
the cog stationary while the input rod and disk move.

The unseen upper guide, ideal bearings, pin fits, hidden axial depths and
resisting tool/shaft load are inferred. Masses use uniform density normalized
to output-family mass 1. Physical scale, material friction, inertia and
transmitted forces are not calibrated. The default working contact is
frictionless; a finite dry-friction load on the output provides retention
during the return. Without that load, this one-click construction can return
the cog instead of retaining the increment. There is no invisible holding
pawl or imposed one-way output constraint.

Native collision approximates rendered cap boundaries by convex cells with
at most 0.02 source pixel of removed-vertex chord distance. The measured
maximum is 0.01985690 pixel. All 2,294 compiled vertices agree with their
collision inputs within 0.00000296 pixel. The ten closed visible solids
are separately checked for topology and sampled full-hardware clearance.
These numerical bounds do not prove continuous clearance or force convergence.

## Validation

The final input stroke is 0.45 world unit, with a three-second cosine cycle.
The native timestep is 0.5 ms and contact time constant is 1 ms. Output
dry-friction torque is 3, output damping is 0.005 and click-hinge damping
is 0.2 in the uncalibrated model units. The shaft-friction constraint uses
a 1 ms reference time and 0.999 impedance. MuJoCo's
[friction model](https://mujoco.readthedocs.io/en/latest/modeling.html#friction)
has finite constraint softness; tightening it alone did not cure the landing
slip. Hinge damping reduces the impact as the click falls into the next space.

Ten cycles in each configuration complete without resets. After the initial
source-pose seating, each cycle advances one tooth. Maximum deviation from
one tooth between successive cycle ends is 0.00003149 tooth forward and
0.00000012 tooth in reverse. Initial seating ends at −1.18627 and +0.59851
teeth respectively, so the first cycle is not claimed as an exact integer
step. The maximum retreat from the furthest position is 0.0064013 tooth
forward and 0.0011864 tooth in reverse.

| Trial | Forward penetration, pixels | Reverse penetration, pixels | Forward retreat, teeth | Reverse retreat, teeth |
| --- | ---: | ---: | ---: | ---: |
| Ten default cycles | 0.028991 | 0.062902 | 0.006401 | 0.001186 |
| 0.25 ms, 0.01-pixel collision tolerance, doubled root sampling | 0.033670 | 0.044826 | 0.006446 | 0.001122 |
| Tooth friction 0.1 | 0.018273 | 0.061791 | 0.013201 | 0.002178 |

Both two-cycle sensitivity trials retain the one-tooth feed in both
directions. Default maximum rod-pin closure error is 0.00002979 source
pixel forward and 0.00005396 in reverse. The results qualify motion under
these assumptions; they do not identify real material or tool-load values.

Earlier nearly undamped trials had appreciable return motion. Raising the
load to 5 reduced that forward motion but made the reversed click miss
its feed. Increasing stroke also worsened return slip. Those trials are
retained as failures, rather than treating arbitrary load or stroke as a
universal fix. The final damping and load are identical in both modes.

The independent full-solid audit checks 21 poses per configuration, making
646,350 bidirectional surface queries in each. It finds no unintended
intersections and verifies the camera bounds. Maximum sampled working
penetration is 0.006116 pixel forward and 0.000181 in reverse. The contact
region alone permits up to 0.1 pixel of soft overlap; other parts receive
only numerical tolerance. This is sampled evidence, not continuous proof.

Five mechanism tests and nine shared engine/runtime tests pass. They check
closed solids, the sole input actuator, compiled collision vertices,
both contact-driven feeds and return behavior, removing tooth contact,
exact restart, mode selection, backward seeking, frame partitioning and
idempotent disposal.

All eighteen final registered catalog views are inspected, including the
source overlay, both click positions, tooth details, rod eye, rear and axial
views. No page errors occur. Default headless Chrome playback averages
27.25 frames per second over 12.0362 wall seconds, advancing 12.0145 native
seconds (99.82% of real time). Existing Three.js clock/shadow-map deprecations
and screenshot readback notices remain. The production build passes with
its existing large-chunk warning. All 37 MuJoCo browser checks pass, including
subdirectory loading, playback, restart and the 121 click-position selector.

## Reproduction and evidence

Bulk evidence remains outside Git under `/dev/shm/121-`. Each study archives
its exact inputs and uses a fresh, exclusive output prefix:

- `baseline-a`: seven inspected views of the replaced animation.
- `source-b`: independent circle, rod-edge and cog readings; inspected overlay.
- `fit-a`, `fit-b`, `fit-d`, `center-fit-a`: diagnostic involute/count fits.
- `comparison-d`: final actual triangle-edge distances; earlier comparisons
  retain the involute profile and the incomplete rod-eye interpretation.
- `dynamics-a` through `an`: historical geometry, reverse-click, timestep,
  load, friction, stroke and damping trials, including failures.
- `dynamics-ao`, `ap`: final ten cycles in each direction; `aq` through `at`:
  finer geometry/timestep and friction trials.
- `clearances-c`, `d`: final forward and reverse full-hardware audits.
- `tests-b.log`, `build-a.log`, `browser-a.log`: targeted tests and production checks.
- `integrated-b`, `integrated-b-inspection`: final catalog capture and review.
- `integrated-final-review-a`: final source and evidence hashes.

Candidate `a` uses the early involute cog and a click that overlaps it.
Only its source overlay, front and click detail were inspected. Candidate
`b` has the final geometry with the earlier low load and nearly undamped
click; eight views were inspected. Neither is final motion evidence.
The final freeze distinguishes historical source changes from exact-current
studies. The all-507 review remains active.

```sh
PROBE_PREFIX=/dev/shm/121-new-source node scripts/measure-reversible-click-source.mjs
TMPDIR=/dev/shm SOURCE_REPORT=/dev/shm/121-new-source.json PROBE_PREFIX=/dev/shm/121-new-comparison node scripts/compare-reversible-click-source.mjs
TMPDIR=/dev/shm DURATION=30 PROBE_PREFIX=/dev/shm/121-new-dynamics node scripts/probe-reversible-click-dynamics.mjs
TMPDIR=/dev/shm SIM_OPTIONS='{"mode":"reverse"}' DURATION=30 PROBE_PREFIX=/dev/shm/121-new-reverse node scripts/probe-reversible-click-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/121-new-clearances node scripts/audit-reversible-click-clearances.mjs
TMPDIR=/dev/shm SIM_OPTIONS='{"mode":"reverse"}' PROBE_PREFIX=/dev/shm/121-new-reverse-clearances node scripts/audit-reversible-click-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-reversible-click.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/121-new-views node scripts/capture-reversible-click-candidate.mjs
```

Captures default to `http://127.0.0.1:5174`; override with `PROBE_BASE_URL`.
The original server stopped before integrated capture `a`, which failed before
producing images. Final capture `b` uses an owned Vite server on port 43923.
Use one owned browser at a time, and do not change active study inputs.

## Local evidence storage recovery

The filesystem filled during this review. An older, ignored 082 raw report
was preserved in the verified persistent archive
`artifacts/review/082-settling-sixteenth-ms-dynamics.json.xz`.
Its decoded SHA-256 is
`9156571f7b66fb84c17fa8b3f31db1f335a976b1c0d1137a1ad6238274159d03`.
The original raw path and its `082-settling-sixteenth-ms-refinement-source-1.txt`
and `082-finer-eight-second-recurrence-source-0.txt` snapshots currently link
to identical `/dev/shm/121-relocated-*` copies. After reboot, restore those
raw targets by decompressing the persistent archive and verify the decoded
hash. No tracked source or original report data was discarded. New bulk
review artifacts and builds stay under `/dev/shm/121-` and outside Git.
