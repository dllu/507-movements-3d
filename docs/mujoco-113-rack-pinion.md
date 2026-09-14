# 113 — Rack and pinion

The catalog uses `src/simulation/mujoco-rack-pinion/`. Either the pinion or
rack can be selected as input; MuJoCo tooth contact drives the other. Gravity
rests the rail on freely turning rollers. This replaces prescribed poses,
extra frame/posts and index dots, and the old rack/roller depth overlap.
Ground and fog are disabled.

## Engraving and reconstruction

Brown's [113 engraving and caption](https://507movements.com/mm_113.html)
show a straight rack under a long rail, a lower pinion, and two support
rollers. The caption permits either rotary or linear input. It does not
specify bearings, depth, guides, stroke, speed or tooth form. The website's
later animation has different proportions and a sixteen-tooth wheel; it is
not the geometry reference for this reconstruction.

The 525-pixel engraving is measured at 100 pixels per world unit. Fixed
threshold ink midlines supply 406 rail readings, 390 circle/rim readings,
114 visible pinion contour readings, and 34 rack tooth-center readings. The
14 rack teeth have visibly uneven pitch. Two center groups merge into ink
at the measurement rows and supply no readings. The script retains all
accepted points and the explicit windows.

Fifteen pinion teeth best fit the visible contour among 14–17 tooth trials;
the upper contour joins the rack, so this is a reconstruction choice. A
coupled fit then adjusts module and initial phase against distances to
actual generated flanks and the rack centers. The result has module
6.86 pixels, pitch radius 51.45 pixels and rack pitch 21.55133 pixels.
Its initial rack tooth origin is shifted 0.57117 pixel from the unconstrained
fit to obtain proper mesh with the pinion. The drawing's tilt is retained as
a presentation rotation of 0.0142846 radian.

The gear generator now accepts addendum and dedendum. Existing defaults
retain identical position-buffer bytes for the recorded sixteen-tooth
sample, and the existing coaxial-gear contact tests pass. Movement 113 uses
shallow teeth with addendum/dedendum 0.8 module, a 20-degree pressure angle
and 0.08-module rounded cutter corners. The mating rack has matching straight
flanks and rounded corners, a 0.1-pixel radial tip clearance, and a root
0.95 module above its pitch line. Tooth flanks and spacing correct Brown's
nearly square, nonuniform drawn teeth. These dimensions are inferred.

Distances to actual transformed mesh edges are:

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Rail top | 238 | 0.57292 | 1.76790 |
| Rail underside | 168 | 0.68401 | 1.89384 |
| Pinion outline | 114 | 2.54432 | 7.78305 |
| Hub | 68 | 0.28375 | 0.88790 |
| Shaft | 61 | 0.34870 | 0.89452 |
| Left roller outline | 59 | 0.40197 | 0.99577 |
| Right roller outline | 59 | 1.58527 | 2.85955 |
| Left inset rim | 72 | 0.57217 | 1.68617 |
| Right inset rim | 71 | 2.05501 | 3.41849 |
| Uniform rack tooth centers | 34 | 3.37370 | 6.58440 |

The ring comparisons select the nearest actual rendered ring edge. Tooth
centers assess the uniform pattern, not the complete rack tooth silhouette.
The largest pinion discrepancy reflects the regularized tooth form and
spacing. These errors are reported rather than treating the fit as an exact
copy of the source.

Seven closed solids form the gear, shaft, hub, rack, rail and two rollers.
The rollers have inset faces matching the two drawn circles. Their heights
are regularized to touch one straight underside, raising the right support
by about 2.4 pixels. Roller depth lies entirely in front of the toothed rack,
with a 3-pixel axial gap; both lie under the broader rail. The rack can pass
behind a roller through the stroke without collision. All depths, the inset
face interpretation, shaft attachment and hidden supports are reconstructed.

## Native mechanics

Five native coordinates describe the pinion hinge, rack travel, rack lift,
and two roller hinges. There is no gear equality. Two position actuators
are installed, but only the selected input has nonzero gain and damping;
the other actuator is disabled. Switching inputs resets the simulation.
Removing tooth contact prevents the passive member from following the input.
The rack orientation, depth and shaft axes are ideal constraints; vertical
rack travel remains free so gravity actually loads the support rollers.

Mass and full inertia are integrated from the closed visible solids at
uniform density, normalized to rack-family mass 1. The input is a smooth
±70-pixel sinusoidal stroke on a six-second cycle with a 0.25-second startup
ramp. The roller shafts have light damping; a roller coasts after the rail
leaves it and is accelerated through friction when the rail returns.
Default working tooth faces are frictionless; roller friction is 0.5.
No material, dimensional scale, applied force or bearing loss is calibrated.

The simulation uses a 0.5 ms timestep, 2 ms contact response, elliptic cones,
Newton iteration and implicit-fast integration. The 355 contact geoms comprise
convex decompositions of the actual pinion, rack and rail plus two cylinders
for the rollers. All 5,564 compiled plate vertices match the construction
within 0.00000597 source pixel. The cylinders reproduce the working roller
surface, while their recessed front faces are checked independently.

A 2 ms trial reaches 0.26526 pixel penetration at roller re-engagement. At
1 ms, two cycles look satisfactory but a ten-cycle run reaches 0.12037 pixel
penetration and 0.19464 pixel mesh error. The selected 0.5 ms step resolves
those impacts more closely. Ten cycles in each input mode give:

| Input | Maximum input error, pixels | Mesh error, pixels | Penetration, pixels | Rack lift, pixels |
| --- | ---: | ---: | ---: | ---: |
| Pinion | 0.38757 | 0.07850 | 0.01072 | 0.00415 |
| Rack | 0.34596 | 0.07614 | 0.00525 | 0.00384 |

Mesh error measures `rack_travel + pitch_radius * pinion_angle`. Both modes
retain complete alternating travel without an accumulating tooth-phase error.
The passive rollers can accumulate rotation, as expected when they coast
between contacts; they are not forcibly returned to their starting angles.

Twelve-second sensitivity trials also retain engagement:

| Variant | Maximum penetration, pixels | Maximum mesh error, pixels |
| --- | ---: | ---: |
| Double outline/cutter resolution | 0.00408 | 0.06875 |
| Half timestep, unchanged contact response | 0.00407 | 0.07623 |
| Rack force +1 model unit | 0.00469 | 0.07622 |
| Rack force −1 model unit | 0.00387 | 0.07713 |
| Tooth friction 0.1, pinion input | 0.01194 | 0.08020 |
| Tooth friction 0.1, rack input | 0.00265 | 0.07553 |

These are visual-motion and numerical-sensitivity checks. Contact forces,
higher friction, longer loaded runs and structural deflection remain outside
the qualification.

## Validation and evidence

Nineteen mechanism, shared runtime, engine and existing coaxial-gear tests
pass. They check closed oriented solids, native plate geometry, two-way
contact drive, loss of transmission with tooth contact removed, passive
roller coasting, exact playback/restart/seeking, input switching and disposal.
The unpowered-member check permits 0.1 pixel of settling or numerical drift;
it does not require a gravity-loaded floating-point mesh to remain bitwise
stationary.

A 27-pose independent surface audit includes the ten-cycle penetration
witness at 54.492 seconds. It makes 775,490 queries against actual triangle
surfaces, finding no unintended intersections. The largest intended contact
penetration is 0.01038 pixel. All rendered vertices stay in the camera bounds.
Rigid attachments are excluded. Intended pinion/rack and rail/roller contacts
allow 0.15 pixel of soft penetration; other cross-family pairs use only a
1e-6-world-unit numerical tolerance. These samples do not prove continuous
clearance between sampled poses.

Ten additional poses with rack input and tooth friction 0.1 make 291,212
surface queries. They find no unintended hardware intersections and only
0.000064 pixel of sampled intended contact penetration. This second audit
checks the reversed power flow and the rack passing behind each roller.

The original seven browser images were inspected. The preview's source
overlay, oblique assembly, right reversal and tooth close-up were inspected;
its other six images are not claimed as reviewed. The overlay confirms the
source proportions and the stated tooth corrections.

All thirteen final integrated images are inspected: source front/overlay,
front/oblique/rear assemblies, midpoint, both travel limits and the cycle,
plus the rack-input reversals and close tooth views in both modes. Complete
assembly views stay in frame; the close views intentionally crop the assembly.
The rail casts a broad shadow over the rack, and rear surfaces are darker.
There is no visible ground, fog or unintended hardware interference.

The registered-factory capture records 722 frames in 12.018834 seconds,
averaging 60.07 fps at 99.9764% physical speed. Mean model-update cost is
2.83 ms and p95 is 3.40 ms. No page errors occur. Existing Three.js
deprecation and GPU readback warnings remain. The isolated production build
passes in 16.99 seconds with existing large-chunk and guarded Node-import
warnings.
All 29 production MuJoCo browser regressions pass, including 113's two input
modes, playback, exact restart, mobile controls and navigation beneath a
static subdirectory.

Reports remain outside Git under `/dev/shm/113-...`. Source measurement
`source-c`, coupled fit `fit-c`, and actual mesh comparison `comparison-a`
are the final geometric evidence. Earlier `source-a/b` and `fit-a/b` are
historical trials. Dynamics `a/b/c` record timestep development; `d` is the
final 0.5 ms ten-cycle pinion trial, and `f` the ten-cycle rack trial. `e` is
the earlier 1 ms rack trial. `g/h` refine geometry/timestep; `i/j` reverse
load; `k/l` add tooth friction. Default values were changed after `d`, but its
explicit options already select the final numerical settings. Source archives
retain every historical input. Overlapping native trials are not used as
isolated performance benchmarks.

`tests-c-log.txt` records all 19 native/shared checks. Surface evidence is
`clearances-a.json` and `rack-friction-clearances-a.json`; final visual
evidence is `integrated-a.json` and `integrated-a-inspection.json`. The build
is `/dev/shm/113-integrated-build-a`, with its corresponding `-log.txt` file.
The isolated browser configuration is `113-integrated-playwright.config.mjs`,
using `113-integrated-server.mjs` on port 43917 at both `/` and `/portable/`.
`113-integrated-browser-log.txt` records the browser results.
`113-integrated-final-review.json` freezes the final source, tests and
documentation and records evidence hashes and historical source differences.

Use fresh prefixes; scripts freeze inputs and refuse to overwrite evidence.

```sh
PROBE_PREFIX=/dev/shm/113-new-source node scripts/measure-rack-pinion-source.mjs
SOURCE_REPORT=/dev/shm/113-new-source.json PROBE_PREFIX=/dev/shm/113-new-fit node scripts/fit-rack-pinion-source.mjs
SOURCE_REPORT=/dev/shm/113-new-source.json PROBE_PREFIX=/dev/shm/113-new-comparison node scripts/compare-rack-pinion-source.mjs
TMPDIR=/dev/shm DURATION=60 PROBE_PREFIX=/dev/shm/113-new-dynamics node scripts/probe-rack-pinion-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/113-new-clearances node scripts/audit-rack-pinion-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-rack-pinion.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/coaxial-gears.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/113-new-views node scripts/capture-rack-pinion-candidate.mjs
```

`SIM_OPTIONS` accepts native and geometry overrides, including `mode: "rack"`.
`TIMES` overrides the surface-audit grid. The browser script uses Vite at port
5174; keep one owned browser at a time and leave its inputs unchanged.
