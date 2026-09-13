# 100 — crank and slotted-lever quick return

The catalog's `#/movement/100` route uses a rotating crank wrist to drive a
passive slotted lever through MuJoCo contact. Only the input shaft is actuated.
The slow stroke lasts 2.715 seconds and the fast return 1.285 seconds, giving
a measured quick-return ratio of approximately 2.113:1 at a four-second crank period.

Brown's [movement 100](https://507movements.com/mm_100.html) identifies a
quick-return crank motion for shaping machines. The earlier synchronous model
leveled the two shaft axes, changed the crank/lever proportions and prescribed
the lever angle. It also added a large ground frame, torus outlines and timing
marks. The reconstruction retains the measured axis offset, broad crank and
complete output extension, with a compact rear bearing support.

## Source reconstruction

`scripts/measure-quick-return-source.mjs` samples complete ink-run midpoints
from `public/engravings/mm_100.png`. One model unit represents 100 source pixels.
Explicit masks avoid the wrist, crank edges, wheel-outline crossings and the
lever's pivot boss. Independent normal scans measure both straight slot walls,
the rounded slot ends and the lever's outer contour.

| Feature | Radius, pixels | Readings | Circle-fit RMS, pixels |
| --- | ---: | ---: | ---: |
| Complete disk | 98.4625 | 75 | 0.6960 |
| Input hub | 36.6856 | 82 | 0.6799 |
| Input shaft | 20.0173 | 102 | 0.4383 |
| Lever pivot boss | 36.8585 | 85 | 1.0172 |
| Fixed pivot shaft | 21.0710 | 111 | 0.6497 |
| Crank wrist | 15.8342 | 99 | 0.9410 |

The input shaft is at (158.0858, 298.9990) and the lever pivot at
(349.5296, 277.2526), retaining the 21.7463-pixel vertical offset. The shaft
centers are 192.6749 pixels apart; the measured wrist gives a 102.5729-pixel
crank radius. The complete rear disk is recentered by 1.8242 pixels to share
the input shaft axis.

A 213-point capsule fit gives slot center (163.1189, 216.1881), raster angle
0.3204359 radian, straight half-length 127.1181 pixels and half-width 17.7144
pixels. Its residuals are **0.9891 pixels RMS and 3.6831 pixels maximum**.
A separate 178-point fit gives the round-ended lever a 34.0327-pixel half-width,
with 0.8892-pixel RMS and 2.8504-pixel maximum residuals. The pivot boss and
nine manually read points complete the output outline.

The slot retains the measured **1.8802-pixel clearance on either side** of the
wrist. Gravity settles the initial lever 0.75589° from its traced pose. The
actual settled slot differs from the independent ink readings by 2.4538 pixels
RMS and 6.0880 pixels maximum; the complete lever outline differs by 2.7991
pixels RMS and 6.2737 pixels maximum. Source-pose fits and settled-assembly fits
are recorded separately. The viewer overlay uses the actual settled model.

## Complete solids and native contact

The disk, hubs, shaft, broad crank, wrist, wrist end, lever, pivot boss, pivot
shaft and rear frame are eleven closed solids. The broad crank uses circular
ends and their common external tangents. The output extension is reconstructed
as a flat continuation of the slotted lever with a smooth curve through the measured rounded outline;
its section and hidden depths are inferred.

The crank occupies Z = −0.26…−0.12 behind the lever at Z = 0…0.18. This ordering
lets the crank rotate without its shaft cutting through the lever. The wrist
projects through the slot to Z = 0.26, with its contrasting end at 0.26…0.28.
The rear frame has finite shaft bores and clears both moving bodies. All layers
are abutting or separated rather than overlapping within a rigid body. Input
and lever mass and full inertia are integrated from the actual closed solids
at uniform density, normalized to unit input mass.

The only coordinates are the two shaft hinges. There are no equality
constraints, return springs or output actuators. Two native boxes supply the
straight slot working faces. Their contact planes agree with the rendered
planes; tests also verify that every box corner remains inside the plate.
The complete finite wrist sweep clears the unused slot end caps by at least
5.1881 source pixels, so those caps do not need separate native contacts.

A sphere contained inside the visible cylindrical wrist supplies its circular
contact section. Its radius matches the wrist and its center lies at the
slot's mid-depth. Under the planar hinges and frictionless contact, its wall
normal and moment about the lever shaft agree with the visible cylinder.
The complete visible cylinder is separately checked against all hardware.
This does not model a sphere-shaped wrist or a freely spinning roller.

The wrist slides without friction. A speculative friction coefficient of 0.03
introduced small stick-slip reversals without any historical friction data;
the retained ideal sliding model has smooth strokes and tighter refinement
bounds. Friction, bearing damping and material properties are not calibrated
to a built machine. The ideal hinges likewise represent bearings without
simulating their contact surfaces.

Defaults are a 0.5 ms timestep, gravity, implicit integration, a 2 ms soft-contact
response, 0.02 hinge damping and input motor gains 10000/200. Initial settling
lasts half a second. Only the initial tangent uses the analytical linkage
relation; subsequent lever motion comes from native contact. Fixed-step
playback and restart do not impose periodic state corrections.

## Validation

Fifteen selected mechanism, shared-runtime, engine and camera tests pass.
Ten uninterrupted crank revolutions are checked at every 0.5 ms step:

| Measurement | Maximum |
| --- | ---: |
| Wrist excess beyond the measured running-clearance envelope | 0.05151 pixel |
| Native soft penetration | 0.05151 pixel |
| Sampled visible wrist/lever penetration | 0.00045 pixel |
| Contact-center distance from the visible slot wall, sampled every 10 ms | 0.00602 pixel |
| Reverse excursion within an otherwise monotonic stroke | 0° |

The lever ranges from −25.2919° to +39.0406°. Both slot faces participate:
580 lower and 61,842 upper contact records. Global extrema from native lever
positions identify the full strokes; a separate monotonicity check bounds any
intermediate reversal, rather than counting tiny velocity zero crossings as
extra machine strokes. The nine complete slow/fast timing comparisons range from 2.11284:1 to
2.11367:1, within 0.065% of the 2.11231:1 ideal crank/lever ratio.

Thirty-three poses pass topology and camera checks across all eleven parts.
Their 1,039,962 independent surface samples find no unintended intersections;
only the working wrist/lever pair has bounded soft penetration. These samples
supplement the explicit axial fits and continuous slot-end sweep bound, without
claiming a proof of every possible hardware clearance.

Over ten turns, halving the timestep from 0.5 to 0.25 ms changes the lever angle
by at most 0.04209°; 0.25 versus 0.125 ms gives 0.02782°. The working contact
surfaces are exact planes and a circular section, so mesh refinement cannot
move those native faces. These are position bounds, not converged impact-force
measurements.

With wrist contact and gravity disabled, the initially stationary lever stays
still while the crank turns. Separate positive and negative torque checks at
an almost stationary crank load the corresponding slot walls, isolating that
test from input-driven inertia. Seeking, different frame partitions and restart
reproduce the same state; disposal releases both native allocations.

Fog and the ground plane are disabled. Camera bounds include the entire lever
swing, complete rear disk and support. The source overlay, working wrist,
pivot, output end and rear assembly are included in the visual study.
All fifteen final images were inspected, including both stroke limits, wrist
clearance from the side, the smoothed output end and the desktop/mobile views.
The final capture averages 60.00 frames per second over 16.216 seconds; mean
physics update time is 0.267 ms and its 95th percentile is 0.5 ms. The production
build and all sixteen MuJoCo browser checks pass, including playback, restart,
navigation during loading and asset-load recovery.

Local evidence is `/dev/shm/100-source-qualified-b.json`, `100-tests-final-c.txt`,
`100-final-b.json`, `100-build-final-b.txt` and `100-browser-final.txt`. The separate
`100-final-inspection.json` records inspected image hashes, frozen source
snapshots and validation evidence. Bulk artifacts stay outside Git.

## Reproduction

```sh
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/100-measured node scripts/measure-quick-return-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-quick-return.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/100-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/100-new-views node scripts/capture-mujoco-quick-return.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh artifact
prefixes, keep one owned browser at a time, and leave source/build files
unchanged during capture.
