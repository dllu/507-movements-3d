# 111 — nested differential micrometer

The catalog uses `src/simulation/mujoco-micrometer/` for a hollow outer screw
and a smaller, nonrotating inner screw. MuJoCo helical constraints produce the
difference between their pitches. Seven closed solids replace the oversized
frame and inconsistent mating threads in the previous animation. A section
control exposes the internal fit. Source interpretation remains under review.

## Source and reconstruction

Brown's [111 caption and engraving](https://507movements.com/mm_111.html)
depict opposite thread hands but claim pitch-difference travel. Those features
are inconsistent for the nested mechanism reconstructed here. With local Z
along both axes, a rotating sleeve in a fixed nut advances by
`z_outer = lead_outer * angle`. A nonrotating inner screw with a matching
internal thread advances by `z_inner = z_outer - lead_inner * angle`.
Opposite signed leads would add their magnitudes. We therefore correct the
inner thread's hand, including the mating internal ridge. This is an explicit
mechanical interpretation, not a faithful reproduction of that source detail.
The earlier authored model also gave its male inner thread and female ridge
opposite hands while prescribing pitch-difference motion.

The [manufacturer's differential-micrometer explanation](https://www.newport.com/n/linear-translation-stage-technology-guide)
describes displacement from the difference of two nearly equal pitches.
The equations above specify the signs and constraints used in this particular
reconstruction; they do not resolve every possible interpretation of Brown.

One world unit represents 100 pixels of the 525-pixel engraving. Eleven
seeded edge groups yield 229 readings. Least-squares fits to 104 outer and
108 inner thread-edge readings give pitches of **28.70633 and 21.59441
pixels**, with respective fit residuals of 0.95555 and 0.74960 pixel RMS.
Their difference gives **7.11192 pixels of inner travel per outer revolution**.
These line-fit residuals measure the source ink, not the final mesh.

Actual mesh extents differ from the 229 edge readings by **1.15978 pixels RMS,
3.01308 pixels maximum**. Actual projected thread flanks differ from their
assigned source turns by **2.98996 pixels RMS / 6.18315 maximum** outside and
**6.84331 pixels RMS / 12.88530 maximum** on the inner screw. The metric keeps
the assigned thread turn and shoulder; it does not match to whichever nearby
turn happens to reduce the error. Continuous helices replace the source's
steep straight bands, and the inner hand is intentionally reversed. The
outline match therefore does not establish whole-image equivalence.

The inner crest radius is 21.30952 pixels. It needs a larger hollow sleeve
than the depicted 22.06127-pixel outer root radius permits. A 0.1-pixel radial
clearance and 2.5-pixel wall increase that root radius to 23.90952 pixels,
an explicit **1.84825-pixel radial correction**. Crest radii, exposed lengths,
head position and rounded inner tip follow the measured silhouette. Hidden
inner length, cap thickness, thread end cuts and wall thickness are inferred.
The omitted fixed outer nut and antirotation guide are ideal constraints;
no decorative frame is added. Fog and ground are disabled.

## Native motion and optional contact model

Only sleeve rotation is actuated. The default native model has four joint
coordinates, one actuator, three equalities and no collision geoms. Its outer
hinge and axial slide are coupled by the outer lead. An inner relative slide
is coupled by the negative inner lead, and a counterrotation joint keeps the
inner screw's world orientation fixed. Output translation comes from the sum
of the two native slides. No animation-frame position assignments prescribe
that output. Removing the nested-thread equality releases it under gravity.

A sinusoidal turn command makes three forward revolutions in eight seconds,
then returns over eight seconds. Expected sleeve and inner travel are
86.11900 and 21.33576 source pixels. This smooth reversing drive is inferred.
Defaults use a 2 ms timestep, implicit integration and a position servo on
the turn joint. Mass and full inertia come from the visible closed solids,
normalized to outer mass 1. Gravity acts downward along the displayed axis.
Density, loads and constraint stiffness are not calibrated physical values.

`threadModel: 'contact'` retains a separate validation model with a passive
inner slide, the ideal outer screw constraint, and **2,996 native convex
contact geoms**. Matching thread surfaces drive the inner slide; there is no
inner-feed actuator or equality. All 25,494 compiled vertices match their
construction vertices within 0.00000598 source pixel. The visible sleeve and
outer/internal ridges use the union of their angular stations, whereas native
thread cells use each ridge's own stations. Thus vertex correspondence does
not establish identical faces or exact convex-hull equivalence. Convex cells
also approximate the nonplanar helical flanks.

At 64 angular divisions the contact model stalled, despite small apparent
pitch-relation errors. That failed trial is excluded from qualification.
At 128 divisions it follows the full three-turn input with maximum angular
error 0.007521 radian, reaching 21.30397 pixels against 21.33576 expected.
Maximum differential error is 0.06248 pixel and native penetration is
0.02039 pixel over the 16-second trial. Its measured **6.535 ms per step** is
too expensive for real-time 2 ms stepping, so the catalog uses ideal joints.
The current contact-mode regression separately checks commanded progress,
output travel and penetration to catch the earlier stalled-model failure.
Contact force calibration, loaded contact runs and convergence remain open.

The section is presentation only: a fixed front clipping plane cuts the
outer solids, with moving caps generated from the analytic helix. Those caps
approximate the intersection of the triangulated surfaces. The complete
physical geometry and inertia remain unchanged, and the inner screw stays
visible. Section toggles do not change native state.

## Validation

A 160-second ideal-joint run completes ten cycles with maximum input-angle
error 0.007534 radian, outer screw error 0.000298 pixel and differential
error **0.000146 pixel**. Inner travel is −0.000295 to 21.33547 pixels and
the largest 2 ms displacement is 0.008379 pixel. Native step cost is
0.00756 ms. Zero contacts here is expected and is not a clearance check.

Thirteen mechanism, shared-runtime and engine tests pass. They cover all seven
closed solids, matching hands, bore/wall clearance, two-cycle runs at loads
0 and ±20 in normalized units, native body poses, constraint removal,
deterministic seeking/restart, section-state independence, optional contact
progress and allocation disposal. The loaded ideal runs keep differential
error below 0.000276 pixel and inner rotation below 0.000000067 radian.
These are ideal-constraint sensitivity checks, not load-capacity ratings.

A separate **65-pose rendered-solid audit performs 12,106,120 surface
queries** over a complete cycle. It samples vertices, edge midpoints and
triangle centroids in both directions between intersecting cross-family
bounds. There is no sampled penetration; the closest thread surfaces remain
0.06286 pixel apart. Minimum threaded overlap is 37.18386 pixels, over
1.7 inner pitches, and minimum cap clearance is 9.99941 pixels. Every
rendered vertex stays inside the camera envelope. Rigid attachments are
excluded. This sampled audit does not prove continuous clearance between
poses or contact convergence.

All thirteen final integrated images are inspected: source front/overlay,
full-cycle poses, front/oblique/rear assemblies and sections at rest, midstroke
and full extension, including a close view of the internal fit. Small pointed
remnants at thread end cuts and cap seams remain visible at high magnification.
The complete assembly stays in frame; the detail view is intentionally cropped.
Live headless playback averages **50.25 fps at 99.96% physical speed** over
12.0204 seconds, with mean model-update cost 0.145 ms and p95 0.200 ms. No
page errors occur. Existing Three.js deprecation and GPU readback warnings
remain. The isolated production build passes with its existing large-chunk
and guarded Node-import warnings.

All **27 production MuJoCo browser regressions pass**, including 111's lazy
loading beneath a static subdirectory, pause/restart, section toggle, mobile
controls and navigation away and back. The suite also verifies loading-failure
recovery and native disposal. Integration makes the reconstruction reviewable;
source interpretation and contact convergence remain open.

## Reproduction and evidence

Use fresh prefixes: scripts retain immutable source snapshots and refuse to
overwrite evidence. Keep one owned browser at a time and do not edit its
inputs during a capture. Bulk artifacts remain outside Git.

```sh
PROBE_PREFIX=/dev/shm/111-new-source node scripts/measure-micrometer-source.mjs
PROBE_PREFIX=/dev/shm/111-new-comparison SOURCE_REPORT=/dev/shm/111-new-source.json node scripts/compare-micrometer-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-micrometer.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/111-new-dynamics DURATION=160 node scripts/probe-micrometer-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/111-new-contact DURATION=16 SIM_OPTIONS='{"threadModel":"contact"}' node scripts/probe-micrometer-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/111-new-clearances node scripts/audit-micrometer-clearances.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/111-new-views INTEGRATED=1 node scripts/capture-micrometer-candidate.mjs
TMPDIR=/dev/shm npm run build -- --outDir /dev/shm/111-new-build
```

The capture expects Vite on port 5174. `SIM_OPTIONS` supports JSON overrides
for native probes, audits and direct-factory captures; integrated captures use
registered defaults. `TIMES` overrides the audit's quarter-second sample grid.

Local source, numerical and surface evidence is `/dev/shm/111-source-a.json`,
`111-comparison-a.json`, `111-dynamics-b.json` (contact), `111-dynamics-c.json`
(ideal), `111-tests-b-log.txt` and `111-clearances-a.json`.
`111-dynamics-a.json` records the rejected coarse contact trial.
The original seven baseline views are recorded in `111-baseline-a.json` and
`111-baseline-a-inspection.json`. Historical reports preserve the candidate
sources used at their creation; catalog status was subsequently changed to
under review. The early `111-candidate-a` preview mistakenly used movement
110's engine metadata with factory 111 and is not integrated evidence.
Final visual evidence is `111-integrated-a.json` and
`111-integrated-a-inspection.json`; the build log is
`111-integrated-build-a-log.txt`. The isolated production browser configuration
is `/dev/shm/111-integrated-playwright.config.mjs`, serving
`111-integrated-build-a` at both `/` and `/portable/` through
`111-integrated-server.mjs`.
The browser log is `111-integrated-browser-log.txt`; the final evidence and
source-hash record is `111-integrated-final-review.json`.
