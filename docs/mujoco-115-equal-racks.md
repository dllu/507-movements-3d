# 115 — Equal pinions driving a double rack

The catalog uses `src/simulation/mujoco-equal-racks/`. One input applies equal,
opposite torques to the two shafts. Both rack faces move the freely sliding
frame through native tooth contact. The frame has ten upper and nine lower
teeth, matching the engraving. This replaces fifteen teeth on each rack,
incorrectly wide proportions, invented support posts and index marks, and
prescribed motion with abrupt stops. The six-second reversing demonstration
keeps the finite rack engaged. Ground and fog are disabled.

## Source and inferred tooth construction

Brown's [engraving and caption](https://507movements.com/mm_115.html) show two
equal wheels meshing centrally and engaging opposite sides of a short oblong
frame. The later website animation is not the geometry reference.

The measurement script records bounded ink-band midpoints, accepted readings
and explicit windows at 100 source pixels per world unit. The midpoint between
shaft centers is (257.98413, 284.00225) pixels; their half-separation is
57.85187 pixels. A −0.0135634-radian presentation tilt aligns the model with
the slightly tilted drawn axis line. The upper and lower shaft radii measure
21.02837 and 20.41690 pixels from 89 readings each.

Twelve teeth best explain the selected gear contours. The irregular drawn
racks have independently fitted pitches of 26.18820 and 28.60000 pixels.
Ordinary unshifted twelve-tooth wheels at the measured shaft spacing need a
larger rack pitch and fit poorly. The reconstruction instead uses equal
**profile-shifted involute gears**, with a 27.33186-pixel rack pitch,
8.7-pixel module and 52.2-pixel reference radius. This preserves both shaft
centers and the observed twelve-tooth form. It is an inferred manufacturable
tooth design; the engraving does not specify profile shift.

The [KHK gear dimension reference](https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/)
distinguishes working and reference pitch radii for shifted gears. With
`inv(a) = tan(a) − a`, equal gears use:

```
working angle = acos(reference radius × cos(20°) / working radius)
profile shift = teeth × (inv(working angle) − inv(20°)) / (2 tan(20°))
```

Here the shift coefficient is 0.8502401. The shared rounded-rack generator
moves its cutter radially by shift × module while retaining rolling travel
at the reference radius. Rack travel per pinion radian therefore remains
52.2 pixels. The working flanks independently agree with analytic involute
angles within 0.00015 radians in the regression test.

The teeth use 20-degree pressure angle, 0.8-module addendum, 1.25-module
dedendum, 0.12-module cutter corners and 0.1-pixel radial rack clearance.
The preliminary coupled fit used 1.05-module dedendum. Increasing it to 1.25
removes central tooth-tip/root interference; the fitted phases and rack
origins are retained. The final actual-edge comparison below evaluates this
deeper-root geometry, rather than reporting the provisional fitting score.
The source's nearly square, irregular teeth are intentionally regularized.

The outer frame is traced with cubic curves. Each inner end is fitted to
independently measured ink midpoints using
`x = c0 + c1 t + sqrt(1 − t²)(c2 + c3 t + c4 t²)`, `y = rootY t`.
This retains the drawn unequal end shapes while accommodating the corrected
rack root height. The short end stubs are shallower than the frame, so the
source's attachment edges remain visible. Seven closed solids form two
gears, two shafts, the frame and its two stubs. Depths, attachments, ideal
shaft bearings and horizontal guide are inferred.

Distances from source readings to actual rendered edges at the initial pose:

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Frame top / bottom | 120 / 120 | 0.54452 / 0.65628 | 1.70691 / 1.57467 |
| Left / right end attachment edges | 26 / 28 | 0.46643 / 0.79970 | 1.37501 / 1.49981 |
| Left / right inner extrema | 15 / 15 | 0.44358 / 0.65939 | 0.90628 / 1.32496 |
| Left / right outer curves | 33 / 40 | 2.25686 / 2.05872 | 5.38359 / 4.62345 |
| Left / right inner curves | 37 / 34 | 0.45371 / 0.51078 | 1.31446 / 1.12816 |
| Upper / lower gear contours | 104 / 90 | 2.21015 / 1.84603 | 7.23516 / 5.81840 |
| Upper / lower shafts | 89 / 89 | 0.52554 / 0.33197 | 1.95103 / 1.00009 |
| Uniform rack tooth centers | 52 | 4.81156 | 12.33949 |

Rack-center errors describe the regularized spacing, not full silhouettes.
The drawing cannot be exactly superimposed while retaining mutually
compatible involute teeth and a single rack pitch.

## Native mechanics and limits

Three coordinates describe the two hinges and the frame slide. A fixed
tendon transmission combines the hinges as `(lower − upper)/2`; its single
servo applies equal opposite torques. This is an ideal shared shaft input,
not an equality tying the gear angles. The rack has no actuator, and no output
position, handoff, reset or synchronization correction is applied during
stepping. The source does not specify how its two shafts receive power.

Both rack faces carry contact in the default run. The central gear mesh has
light, intermittent contact because the shaft torques are balanced. Equal
shaft torque does not imply exactly equal instantaneous rack forces: inertia,
backlash and the soft contacts affect the force split. Material, applied
forces, structural deformation and scale are not calibrated. An upper-only
input remains available as a diagnostic option; it leaves the lower rack
unloaded in the original trial and is not the catalog's paired-drive setup.

Mass and full inertia come from all seven rendered solids at uniform density,
normalized to frame mass 1. The three toothed plates provide 883 convex
collision cells. All 11,088 compiled vertices match the visible construction
within 0.00000585 source pixel. Shafts and end stubs are clear of other moving
families and are checked independently as actual surfaces.

The default uses 1 ms steps, 4 ms contact response, a discrete integrator,
exact constraint inertia, Newton solving and frictionless tooth contact.
The [MuJoCo computation documentation](https://mujoco.readthedocs.io/en/latest/computation/)
explains how discrete integration treats stiff elements within the constraint
solve. Earlier implicit-fast trials with approximate constraint inertia
became unstable at very small contact gaps; timestep reduction and softer
contact alone did not resolve them. Exact inertia or discrete integration
resolved the observed failures. The catalog uses both. Native study scripts
count automatic time resets and reject those runs rather than accepting a
finite state after MuJoCo has reset it.

Ten cycles (60 native seconds) retain a frame range of
−0.75098910 to +0.75098904, with maximum native penetration 0.00976195 pixel,
mesh displacement error 0.08395833 pixel and input tracking error
0.26398102 pixel. There are no automatic resets. Two-cycle sensitivity runs:

| Trial | Maximum penetration, pixels | Maximum mesh error, pixels |
| --- | ---: | ---: |
| 0.5 ms timestep | 0.00907 | 0.08230 |
| 2 ms timestep | 0.01299 | 0.08628 |
| 128 tooth samples / 4,096 cutter steps | 0.00827 | 0.08094 |
| Friction 0.1, frame load +1 | 0.01241 | 0.08627 |
| Friction 0.1, frame load −1 | 0.00798 | 0.08086 |

Every trial retains both rack contacts and the complete reversing stroke.
These are numerical sensitivity checks, not calibrated force convergence.
The independent 25-pose surface audit makes 3,055,300 vertex, edge-midpoint
and triangle-centroid queries, finding at most 0.00189048 pixel of intended
soft tooth penetration and no unintended intersections. It checks all seven
solids and full-stroke camera bounds. This is sampled, not continuous,
clearance evidence.

Tests also disable each rack interface independently and confirm the other
still drives the frame in both directions. Removing every contact leaves the
frame stationary while both shafts rotate. Restart, backward seeking and
frame partitioning reproduce native state exactly; disposal frees the model
and data. Zero-shift position-buffer bytes remain identical for three
representative existing gear configurations.

All 29 targeted numerical, shared-generator, runtime and engine tests pass.
All twelve registered-factory views are inspected, including source overlay,
both stroke ends, all three tooth interfaces, oblique and rear views. Headless
playback records 51.43 fps at 99.86536% physical speed, with no page errors.
Existing Three.js deprecation and screenshot readback warnings remain.
The production build passes, and all 31 production MuJoCo browser regressions
pass in 6.3 minutes, including playback, pause, restart, mobile navigation,
asset failure/retry and static-subdirectory loading.

## Reproduction and evidence

Bulk artifacts are outside Git. The study reports retain source hashes and
exclusive copies of their inputs. Historical failures are preserved; they
are not qualification evidence. The decisive reports use these prefixes in
`/dev/shm/`:

- `115-baseline-a`: seven inspected views of the replaced implementation.
- `115-source-a`, `115-fit-c`, `115-cap-fit-a`: measured source, provisional
  coupled gear fit and final inner-end fitting.
- `115-comparison-b`: final actual rendered edge comparison.
- `115-dynamics-k`: ten-cycle paired-drive run; `l`–`p`: sensitivity trials.
- `115-clearances-a`: independent actual-surface audit.
- `115-candidate-a`, `115-integrated-a`: direct and registered factory views.
- `115-integrated-final-review-a.json`: final evidence and inspection manifest.

The final manifest records input compatibility explicitly. The long native
and surface studies predate only the catalog registration and visible status
text; their geometry and physics bytes remain the qualified versions.

Use fresh output prefixes; scripts refuse to overwrite evidence. Browser
captures use the existing development server at port 5174.

```sh
PROBE_PREFIX=/dev/shm/115-new-source node scripts/measure-equal-racks-source.mjs
SOURCE_REPORT=/dev/shm/115-new-source.json PROBE_PREFIX=/dev/shm/115-new-comparison node scripts/compare-equal-racks-source.mjs
TMPDIR=/dev/shm DURATION=60 PROBE_PREFIX=/dev/shm/115-new-dynamics node scripts/probe-equal-racks-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/115-new-clearances node scripts/audit-equal-racks-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-equal-racks.test.mjs tests/shifted-involute.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/115-new-views node scripts/capture-equal-racks-candidate.mjs
```
