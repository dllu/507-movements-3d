# 117 — Cam between two rollers in a yoke

The catalog uses `src/simulation/mujoco-roller-yoke/`. Only the cam is
actuated; native contact moves the guided yoke and turns its two independent
rollers. The reconstruction replaces the old animation-derived cam,
prescribed follower and roller motion, floating stem connections and invented
support frame. A revolution takes five seconds after a smooth startup.
Ground and fog are disabled, and the camera includes the entire stroke.

## Source geometry

Brown's [engraving and caption](https://507movements.com/mm_117.html) show a
cam acting between friction rollers in a yoke, for operating a steam-engine
valve. The reconstruction fits the original engraving rather than the
website animation. Measurements use bounded ink midpoints at threshold 110
and 100 source pixels per world unit.

The shaft center is (129.81738, 170.98289) pixels and its radius is
26.52452 pixels. Independently fitted roller radii are 19.38214 and 19.39384
pixels; the model uses their mean, 19.38799 pixels. Their centers are
regularized onto the shaft's vertical axis with a spacing of 165.35264
pixels. The initial yoke displacement from its centered position is
−22.29548 pixels. This corrects small inconsistencies in the drawing while
preserving the measured cam, rollers and frame proportions.

The roller-center pitch curve is
`r(φ) = R + Σ[aₕ cos(hφ) + bₕ sin(hφ)]`, with `R = 82.67632` pixels.
Only odd harmonics are used, so `r(φ) + r(φ + π) = 2R` exactly. This is the
constant spacing required by the two opposite rollers. The cam surface is
the inward normal offset of that pitch curve by the roller radius, rather
than a radial subtraction. The initial pose constrains `r(π/2) − R` to the
measured yoke displacement.

| Harmonic | Cosine coefficient, pixels | Sine coefficient, pixels |
| --- | ---: | ---: |
| 1 | 4.76983631 | −20.18932947 |
| 3 | 5.53981545 | 4.51404479 |
| 5 | −0.44381992 | 1.47368448 |
| 7 | −1.75087340 | −0.93420631 |

The fit uses 134 readings of exposed cam ink, excluding hidden contours
and the adjacent yoke rails. The minimum offset Jacobian is 0.34729, so
the offset remains regular without cusps. Actual rendered-edge distances
at the native initial pose are:

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Cam | 134 | 1.57099 | 4.93196 |
| Shaft | 81 | 1.00637 | 3.93899 |
| Upper / lower roller | 49 / 80 | 0.62271 / 1.45047 | 1.75305 / 3.41514 |
| Upper / lower pin | 37 / 41 | 1.33114 / 0.68124 | 2.12063 / 1.17105 |
| Left rail, left / right edges | 26 / 34 | 0.28846 / 0.29994 | 1.44231 / 0.70588 |
| Right rail, right edge | 34 | 0.22254 | 0.95588 |
| Upper crossbar, top / bottom | 42 / 42 | 0.41188 / 0.21296 | 0.75000 / 0.54762 |
| Lower crossbar, top / bottom | 40 / 41 | 0.33912 / 0.37864 | 0.84999 / 0.81708 |
| Left cheek, left / right edges | 14 / 30 | 0.27894 / 0.51532 | 0.89286 / 1.96667 |
| Right cheek, left / right edges | 10 / 30 | 0.62450 / 0.50580 | 1.60000 / 0.95000 |
| Lower guide, top / bottom | 41 / 44 | 0.34536 / 0.26382 | 0.87805 / 0.62500 |

The right rail's left edge has only seven identical quantized readings;
its near-zero residual does not imply physical precision beyond the ink
width. Pins are normalized to the roller axes, explaining their larger
residuals than independent circle fits. Fork outlines, fastener details,
hidden depth and ideal bearings are inferred rather than independently
fitted. The two thin fork arms support an ordinary cantilevered roller pin.
The rails, cheeks and crossbars meet without doubled interior volume.

The source breaks off the lower stem near pixel 427. The model continues
it to pixel 479, leaving the rod in the fixed guide throughout its full
stroke. At maximum lift its end remains about 14 pixels below the guide.
This continuation is intentional and is stated in the catalog note.

## Native mechanics and limits

Four native coordinates represent the cam hinge, yoke slide and independent
roller hinges. There is one cam position actuator, no equality constraints,
no tendons and no output-coordinate corrections. The input rotates clockwise
with a 0.2-second exponential startup. Mass and full inertia come from the
27 closed visible solids at uniform density normalized to yoke mass 1;
the fixed guide is excluded from moving mass.

Default physics uses gravity, friction 0.3, 0.5 ms steps, 2 ms contact
response, discrete integration, exact constraint inertia and Newton solving.
The cam has 360 convex collision cells. All 3,866 compiled vertices agree
with the visible construction within 0.00000294 source pixel. Each roller
uses an analytic capsule whose outer radius matches the visible rim. Its
rounded ends remain inside the rendered roller depth, and its filled pin
bore is inaccessible to the cam under the ideal planar joints. The visible
192-sided rim differs from the analytic circle by at most 0.00260 pixel.
Other hardware is checked independently; bearings and the vertical guide
are ideal joint constraints, not simulated bearing contacts.

Ten cycles (50 native seconds) retain yoke travel from −0.24849793 to
+0.24849120 world units. Maximum displacement error against the conjugate
pitch law is 0.00473117 source pixel, native penetration 0.00420478 pixel
and input error 0.00122511 radian. There are no automatic resets.

| Two-cycle sensitivity trial | Maximum motion error, pixels | Maximum penetration, pixels |
| --- | ---: | ---: |
| 0.25 ms timestep | 0.002262 | 0.001883 |
| 2,048 cam samples | 0.004975 | 0.004645 |
| Friction 0.05 | 0.002185 | 0.001540 |
| Friction 0.6 | 0.003518 | 0.003044 |

Gravity loads the upper roller more heavily. The lower roller has light,
intermittent contact and can slip or coast. Its accumulated rotation over
ten seconds varies from 31.85 to 35.93 radians with timestep and mesh
resolution, and from 23.86 to 35.96 radians across the friction trials.
Upper roller rotation remains approximately 42.613 radians. These results
qualify the yoke motion, not convergence of the lower roller's exact spin
or contact forces. Neither a no-slip law nor an output load is imposed;
physical scale, material friction and valve loading are not calibrated.

Removing all contacts lets the yoke fall while the cam keeps turning and
the rollers stay still. With either roller contact disabled, the remaining
roller drives a complete cycle when gravity presses it onto its working
flank. The lower-only diagnostic reverses gravity. Both diagnostics keep
yoke error below 0.002104 pixel, without prescribing its position.

An independent 21-pose audit makes 1,080,198 surface-vertex, edge-midpoint
and triangle-centroid queries. It finds no unintended intersections and
checks all hardware against the full-motion camera bounds. Maximum sampled
working-contact penetration is 0.00062650 pixel. Only the outer cam and
roller working surfaces allow soft penetration; pins, forks, stems and the
guide bore do not. This sampled audit is not continuous interference
certification and does not replace the larger all-step native result.

Six mechanism tests and nine shared engine/runtime tests pass, including
closed-solid checks, contact removal, deterministic restart and backward
seeking, frame partitioning and native allocation disposal. All thirteen
integrated views have been inspected, including source overlay, stroke
positions, both contacts, guide, axial, oblique and rear views. Playback
records 60.07 fps at 99.97421% physical speed with no page errors. Existing
Three.js deprecation and screenshot-readback warnings remain.
The production build and all 33 production MuJoCo browser regressions pass
in 6.7 minutes, including playback, pause, restart, mobile navigation,
asset failure/retry and static-subdirectory loading.

## Reproduction and evidence

Bulk evidence remains outside Git. Reports record input hashes and archive
their source files. The decisive `/dev/shm/117-` prefixes are:

- `baseline-a`: seven inspected views of the replaced implementation.
- `source-b`, `fit-b`: final engraving readings and constrained cam fit.
- `comparison-b`: actual rendered-edge distances at the native initial pose.
- `dynamics-b`: ten-cycle final construction; `c` through `f`: sensitivity trials.
- `clearances-b`: independent surface audit of all 27 solids.
- `tests-a.log`, `build-a.log`, `browser-a.log`: validation logs.
- `integrated-a`, `integrated-a-inspection`: registered catalog capture and review.
- `integrated-final-review-a.json`: evidence hashes and input compatibility.

The preliminary `source-a` and `fit-a` included two rail-ink readings
incorrectly attributed to the cam; they are retained as historical evidence.
The preliminary `comparison-a` included zero-length projected guide edges
and invalid guide residuals, corrected in `comparison-b`. Candidate views
and `dynamics-a` predate the four lower fastener solids. Final native studies
predate only the display-status change; geometry and physics are unchanged.
This progress does not complete the all-507 review.

```sh
PROBE_PREFIX=/dev/shm/117-new-source node scripts/measure-roller-yoke-source.mjs
TMPDIR=/dev/shm SOURCE_REPORT=/dev/shm/117-new-source.json PROBE_PREFIX=/dev/shm/117-new-comparison node scripts/compare-roller-yoke-source.mjs
TMPDIR=/dev/shm DURATION=50 PROBE_PREFIX=/dev/shm/117-new-dynamics node scripts/probe-roller-yoke-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/117-new-clearances node scripts/audit-roller-yoke-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-roller-yoke.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/117-new-views node scripts/capture-roller-yoke-candidate.mjs
```
