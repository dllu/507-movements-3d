# 112 — Persian drill

`src/simulation/mujoco-persian-drill/` reconstructs a stationary head, a
rotating grooved stock and bit, and a nonrotating hand grip. Only the grip's
axial motion is actuated. Native thread contact turns the stock in alternating
directions. The catalog reconstruction replaces the previous floating tube ridges, excess
collars and index dots, and invented spiral detail on the bit. Ground and fog
are disabled. The section view exposes the grip's internal fit.

## Source geometry

Brown's [112 engraving and caption](https://507movements.com/mm_112.html)
describe pushing and pulling a threaded button along a freely rotating stock,
supported by a head against the operator's body. The source specifies a quick
thread but gives no lead, start count, thread section or hidden bearing detail.

The reconstruction uses 100 engraving pixels per world unit. Twelve edge
groups supply 703 readings, including the 12.22392-pixel stock crest radius
and the top/bottom positions of the head, grip and chuck. Horizontal ink
profiles supply 368 additional readings. Two ambiguous rows are excluded by
the measurement script: the grip's left edge at row 264 is too faint at the
fixed threshold, and the bit's unresolved tip at row 495 produces only one
central ink band. Earlier reports incorrectly treated the right-hand band at
264 as the left edge, producing a spurious 53-pixel error. The omitted rows
and reason are retained in the source report.

The 125 assigned diagonal bands include 58 readings above and 67 below the
grip. A cylindrical-helix fit tests one through ten starts. Six and seven
starts fit almost equally well: 1.02681 versus 0.97461 pixels RMS. Six starts
are chosen as an explicit interpretation; the drawing does not establish an
exact count. The fitted pitch is 12.39236 pixels, giving **74.35416 pixels of
lead per revolution**. Upper and lower bands are seeded separately so the
search does not silently omit lower strokes that depart from the upper
pattern. Assigned band numbers are retained in the final comparison.

Actual transformed mesh extents differ from the 703 edge readings by
**0.71278 pixel RMS, 2.41842 pixels maximum**. Horizontal intersections with
the actual head, grip, chuck and bit surfaces differ from the 368 profile
readings by **1.71841 pixels RMS, 14.18940 maximum**. The large maximum is at
a flange transition drawn at slightly different heights on its two sides;
the reconstructed turned flange is level. The head has a similar local
9.73871-pixel discrepancy at its cap/neck transition. These maxima are
reported rather than hidden behind the extent metric. The thread-groove
comparison uses actual rendered crest/flank edges shifted by the inferred
half groove width. Its 125 residuals are **1.02473 pixels RMS, 2.25232 maximum**.

Seventeen closed solids retain the slender stock, broad head, waisted grip,
plain chuck and flat, waisted bit outline. Coaxial turned surfaces correct the
source's small offsets and asymmetries. A fitted smooth cap and curved neck
replace the earlier oversized head; the bearing collar and grip's lower
flange follow corrected source heights. The bit is centered on the shaft,
rather than inheriting its roughly 1.75-pixel offset in the drawing.

The shallow square grooves are 2 pixels wide and 1.8 pixels deep, with
0.1-pixel radial and axial flank clearances. Their section is inferred from
single ink strokes. Broad solid helical lands abut a continuous core; matching
internal ridges project from the bored grip. The head has a blind bearing
bore with radial clearance and a 3-pixel end gap above the stock. The flat
bit's 4-pixel thickness and all hidden dimensions are reconstructed. There
is no cutting workpiece or calibrated cutting action.

## Native simulation

The stock has a passive Z hinge. The grip has an actuated Z slide and cannot
rotate, representing the operator's hand. The head bearing fixes the stock
axis and axial position. There is no screw equality, stock actuator, or
periodic position reset. With this thread hand, the expected relation is
`grip_translation + lead_per_radian * stock_angle = 0`.

The sinusoidal grip command travels ±82 source pixels on a six-second cycle.
A 0.25-second startup ramp begins at rest in the engraving's middle position.
The full stroke turns the stock about 2.206 revolutions in each direction.
This timing and operator input are inferred. Mass and full inertia are
integrated from the visible closed parts at uniform density, normalized to
grip mass 1. Gravity acts along the shaft. Bearings and the hand's restraint
are ideal; loads and material density are not calibrated.

The default uses 64 angular divisions with additional thread-end stations,
a 4 ms timestep, 8 ms contact response, elliptic friction cones and
frictionless working faces.
The 1,802 native convex geoms cover the working threads. The remaining
hardware must be checked independently against the rendered solids. The
visible stock/core and grip ridges use unions of their respective angular
stations. Native cells use each ridge's own stations; correspondence of
vertices does not imply identical triangulated faces or exact helical hulls.
All 14,368 compiled mesh vertices match construction vertices within
0.000000192 source pixel.

Coarsening to 32 divisions locked the model. At 48 divisions it turned but
had 11.98 pixels of input error and 0.18276 pixel of penetration. Those trials
are rejected. A 2 ms, 64-division version followed the drive but ran at only
80.40% physical speed in the browser. The 4 ms version's two-cycle native
trial keeps the screw relation within 0.05244 pixel and penetration within
0.02810 pixel. Its browser candidate runs at approximately **25.70 fps and
99.70% physical speed**, with no page errors.

The section clips only the front of the grip. Caps follow its fixed section
and the analytic internal helices, translating rigidly with the grip. These
caps approximate the triangulated thread intersections. The complete native
contacts and inertia remain present, and the stock is not clipped.

## Numerical and surface checks

A 60-second run completes ten cycles. Maximum commanded grip error is
0.54250 pixel, screw-relation error 0.05244 pixel and native penetration
0.02810 pixel. The stock travels from −6.91796 to +6.94921 radians against
nominal extrema ±6.92929. The largest 4 ms angular step is 0.043763 radian.
Errors do not grow across cycles. This run preceded the explicit friction-cone
selection; the final default reproduces every sampled position, velocity and
time in its first two cycles exactly. With frictionless contacts, selecting
elliptic cones does not change those measured dynamics.

The following 12-second comparisons retain both complete cycles. The torque
values are in normalized model units, not physical load ratings.

| Variant | Maximum penetration, source pixels | Maximum screw error, source pixels |
| --- | ---: | ---: |
| Default: 64 divisions, 4 ms | 0.02810 | 0.05244 |
| 64 divisions, 2 ms | 0.01806 | 0.04002 |
| 96 divisions, 4 ms | 0.02442 | 0.07465 |
| Stock torque +0.02 | 0.03510 | 0.06330 |
| Stock torque −0.02 | 0.03114 | 0.05422 |
| Sliding friction 0.05, elliptic, 4 ms | 0.06675 | 0.10690 |
| Sliding friction 0.05, elliptic, 2 ms | 0.01575 | 0.04152 |

The 2 ms and 96-division trajectories differ from the default at 100 ms
samples by at most 0.017584 and 0.005480 radian respectively. Their grip
positions differ by at most 0.24526 and 0.02260 pixel. Refinement reduces
penetration, but the screw-error metric is not monotonic with mesh density.
These are visual-motion and numerical-sensitivity checks; contact forces,
larger friction coefficients, cutting loads and long loaded runs are not
qualified.

Friction 0.05 with pyramidal cones at 4 ms binds and reaches 1.17195 pixels
of penetration; that configuration is rejected. Elliptic cones resolve the
binding at the same timestep, and halving the pyramidal timestep also restores
motion. [MuJoCo documents both friction formulations](https://mujoco.readthedocs.io/en/latest/computation/).
The comparison identifies sensitivity to the solver formulation and timestep;
it does not establish a physical self-locking condition. A dedicated
friction regression prevents accepting a stopped stock as correct motion.

A separate 26-pose audit makes **22,209,252 independent queries against
rendered surfaces**, including the native penetration witness at 0.352 second.
There is no sampled penetration. The nearest sampled thread surfaces are
0.01624 pixel apart, reflecting the difference between convex collision cells
and the visible helical faces. Thread engagement remains 52.18885 pixels,
over four pitches, throughout the stroke. All rendered vertices remain inside
the camera bounds. The audit checks vertices, edge midpoints and triangle
centroids in both directions between intersecting cross-family bounds;
rigid attachments are excluded. It does not prove continuous clearance between
samples or contact-force convergence.

The friction-0.05 audit adds nine poses and 7,687,818 surface queries,
including its startup penetration witness. It finds no unintended hardware
intersections and a maximum of 0.00736 pixel in the intended thread contact.
Both audits allow at most 0.15 pixel of intended soft contact and only a
1e-6-world-unit numerical tolerance for other cross-family pairs.

Fourteen mechanism, runtime and engine checks pass: all seventeen solids are
closed and consistently oriented; thread hands and groove fits agree; native
vertices compile correctly; only the grip is actuated; disabling contact
stops the initially stationary stock while the grip still moves; repeated
reversals, the friction case, exact restart/seeking, section-state independence
and native allocation disposal all pass.

All thirteen final integrated images are inspected: source front and overlay,
front/oblique/rear assemblies, both reversals, midpoint and cycle poses, and
sections at rest, upper/lower travel and close range. The complete assembly
stays in frame; the close view is intentionally cropped. Dark undersides and
fine groove shadows remain visible, but there is no apparent unintended
part interference or ground shadow.

The final registered-factory capture averages **25.24 fps at 99.74% physical
speed** over 12.0439 seconds. Mean model-update cost is 18.38 ms and p95 is
24.60 ms. There are no page errors. Existing Three.js deprecation and GPU
readback warnings remain. The isolated production build passes with its
existing large-chunk and guarded Node-import warnings.
All 28 production MuJoCo browser regressions pass, including 112's playback,
restart, section control, mobile layout and navigation beneath a static
subdirectory.

## Evidence and reproduction

The seven original views are inspected and recorded in
`/dev/shm/112-baseline-a.json` and `112-baseline-a-inspection.json`.
Current measured source and mesh comparison reports are `112-source-c.json`
and `112-comparison-b.json`. Earlier `112-source-a` undersampled the lower
thread bands; `112-source-b` retained the two ambiguous profile rows. Neither
is the final source-comparison input.

Native development reports `112-dynamics-b` through `112-dynamics-e` record
the 64/32/48-division trials and the 4 ms trial respectively. They preserve
their exact historical inputs. `112-candidate-a` records the slower 2 ms
browser version, and `112-candidate-b` records the 4 ms version with sections.
`112-dynamics-f` is the ten-cycle run. `112-dynamics-g/h` are timestep/mesh
refinements, `112-dynamics-i/j` are the reversed-torque cases, and
`112-dynamics-k` is the rejected pyramidal friction case. The elliptic and
half-timestep friction runs are `112-dynamics-l/m/o`; `112-dynamics-n`
reproduces the final default. Native tests and surface audits are
`112-tests-b-log.txt`, `112-clearances-a.json` and
`112-friction-clearances-a.json`. The sensitivity runs overlapped other
native checks, so their wall timings are not used as isolated performance
measurements.
Final visual evidence is `112-integrated-a.json` and
`112-integrated-a-inspection.json`. The build log is
`112-integrated-build-a-log.txt`. The isolated browser configuration is
`/dev/shm/112-integrated-playwright.config.mjs`, serving
`112-integrated-build-a` at `/` and `/portable/` through
`112-integrated-server.mjs`. All 28 browser results are retained in
`112-integrated-browser-log.txt`. `112-integrated-final-review.json` freezes
the final source, tests and documentation and records the evidence hashes,
historical source differences and qualification limits.

Use fresh output prefixes. Scripts preserve immutable inputs and refuse to
overwrite evidence. Bulk reports and images remain outside Git. The browser
capture expects Vite on port 5174; keep one owned browser at a time and do not
change its inputs during capture.

```sh
PROBE_PREFIX=/dev/shm/112-new-source node scripts/measure-persian-drill-source.mjs
PROBE_PREFIX=/dev/shm/112-new-comparison SOURCE_REPORT=/dev/shm/112-new-source.json node scripts/compare-persian-drill-source.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/112-new-dynamics DURATION=60 node scripts/probe-persian-drill-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/112-new-clearances node scripts/audit-persian-drill-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-persian-drill.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/112-new-views INTEGRATED=1 node scripts/capture-persian-drill-candidate.mjs
TMPDIR=/dev/shm npm run build -- --outDir /dev/shm/112-new-build
```

`SIM_OPTIONS` accepts JSON overrides for native probes, audits, comparisons and
direct-factory captures. `TIMES` overrides the clearance sample grid.
