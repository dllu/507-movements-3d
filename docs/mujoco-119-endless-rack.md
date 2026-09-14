# 119 — Pinion travels around an endless rack

The catalog uses `src/simulation/mujoco-endless-rack/`. A uniformly driven
pinion moves vertically while its teeth reciprocate the horizontal rack.
Native tooth contact determines travel along the rack, with additional
**ideal normal engagement support** keeping the mesh together. This support
is an explicit reconstruction assumption; the bare slot and teeth do not
retain engagement in the tested construction.

The reconstruction corrects the initial rack position, generates compatible
involute pinion and end teeth, restores the thick rod and broad slotted
guide, and removes invented beam edge rails. One complete circuit takes
eight seconds, comprising four and a half pinion revolutions. Ground and
fog are disabled. The camera fits the full stroke. Section view outlines
the front guide so that the pinion remains visible; the full opaque guide
can be restored without changing the physics state.

## Source reconstruction

Brown's [engraving and caption](https://507movements.com/mm_119.html) specify
uniform pinion rotation, a reciprocating bar carrying an oblong endless
rack, and a shaft moving vertically in a slotted bar. The reconstruction
interprets the outline as eight pinion teeth, eight teeth on each straight
run and six around each end. Uneven spacing and overlap make some tooth
boundaries ambiguous. The four small circles are interpreted as bores.

Independent bounded ink readings use threshold 110 and quarter-pixel
sampling, at 100 source pixels per world unit. The slot-axis estimate is
270.26591 pixels. The rack center is reconstructed at (270, 319), placing
the pinion near the middle of the top run as drawn. The measured hub center
is (270.16002, 231.57821); the compatible initial pinion center is
(270.26591, 231.8). Hub radius is 12.80320 pixels. Four independent bore fits
give radii 6.47599, 6.55398, 6.62898 and 6.04994 pixels.

The common module is 8.72 source pixels, pressure angle 20 degrees,
addendum 0.8 module and dedendum 1 module. Generated circular teeth use
the shared rack cutter with 0.12-module corners, 96 samples per tooth and
2,048 cutter steps. The eight-tooth pinion has pitch radius 34.88 pixels.
Each rounded rack end follows half of a generated twelve-tooth gear, with
pitch radius 52.32 pixels. Straight teeth use the corresponding trapezoidal
rack flanks. Their half-span is `4πm`; the pinion-center capsule radius is
`10m`. Tooth spaces lie at the straight/end junctions. Initial pinion phase
is −0.00762354 radians.

A pinion-only fit favors a smaller module, 8.28 pixels, with 1.64112-pixel
RMS edge error. That does not determine a compatible whole assembly.
A joint pinion/rack fit numerically favors seven teeth per rounded end
(pinion RMS 2.22915, rack RMS 4.59285 pixels). The selected six-end-tooth
interpretation preserves the visible source count, with pinion RMS 2.49613
and combined rack RMS 4.80993 pixels. Regularizing the drawing's uneven
teeth therefore requires visible local corrections. This is not an exact
tracing of every tooth.

The following distances compare independent ink points with intersections
of the actual rendered triangles, including the four bore boundaries.
Pinion and rack readings exclude the guide overlap and other merged ink.

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Pinion | 46 | 2.49613 | 6.00559 |
| Rack left end | 77 | 5.49626 | 10.30069 |
| Rack right end | 72 | 4.57986 | 8.97139 |
| Rack top / bottom | 94 / 85 | 4.56750 / 4.59039 | 9.17024 / 9.58977 |
| Upper-left / lower-left bore | 70 / 72 | 0.36408 / 0.38677 | 0.78596 / 1.02866 |
| Upper-right / lower-right bore | 40 / 72 | 0.38782 / 0.32143 | 1.87641 / 1.02534 |
| Hub | 46 | 0.75148 | 1.61465 |
| Upper beam top / bottom | 178 / 127 | 0.76717 / 0.97788 | 1.61149 / 2.09933 |
| Lower beam top / bottom | 179 / 101 | 0.50063 / 1.44922 | 1.20425 / 2.08253 |
| Left rod top / bottom | 40 / 43 | 0.35549 / 0.32227 | 0.62787 / 0.87787 |
| Right rod top / bottom | 27 / 25 | 0.74756 / 0.30581 | 1.56553 / 0.62213 |
| Guide left / right | 71 / 31 | 0.75395 / 0.43038 | 1.62680 / 0.51610 |
| Slot left / right | 55 / 55 | 0.52806 / 0.22268 | 1.35454 / 0.36364 |

Nine closed solids represent the pinion, shaft, hub, nonrotating journal,
rack, rear rod, front guide and two beams. Hidden depths are inferred. The
rod has a circular cross-section with a flattened front mounting seat at
the rack's rear face. The attachment has finite area and disjoint solid
interiors. Its front is at `z = −0.12`; the gear and shaft end at `z = −0.10`,
leaving 0.02 world units of axial clearance. The rod partly occludes the
lower bores from behind. No unseen bolts are asserted.

The front guide lies ahead of the gear. Its opaque geometry naturally
occludes the pinion, while the engraving uses overlapping diagrammatic
lines. Default section view replaces only its visible surface with an
outline; the complete guide remains available and participates in the
independent clearance audit. At the bottom of travel, the lower beam can
occlude the gear in a front projection, but their depths are separated.
Broken beam ends are reconstructed from the drawing rather than interpreted
as a complete offscreen frame.

## Native motion and ideal engagement support

Three coordinates represent vertical carrier translation, the pinion hinge
on that carrier and horizontal rack translation. There is one position
actuator on the pinion, no equality constraint and no tendon. The shaft's
horizontal position, rack orientation and vertical slot end limits are ideal
constraints. The slot allows 0.00245 world units of endplay beyond the
nominal pinion-center path. Initial pinion and rack velocities are seeded
consistently with rolling; no output position or velocity is overwritten
during stepping.

With retention disabled, the final geometry loses engagement at the first
end. Over sixteen native seconds the rack travels to −16.24855 world units,
and the center-path error reaches 1,430.60 source pixels. This rules out
claiming that this particular bare reconstruction is self-retaining; it does
not establish that every possible interpretation of Brown's drawing fails.

Additional normal support is represented by a geometric spring and damper.
Let `(x, y)` be the pinion center relative to the rack, `L` the straight-run
half-span, and `H` the nominal center-path radius. Define

```text
dx = x − clamp(x, −L, L)
r = hypot(dx, y)
g = r − H
n = (dx, y) / r
U = K g² / 2
```

The generalized force is the negative gradient of `U`, with damping only
along `n`. Defaults are `K = 10000` and damping 100 in normalized units.
The support depends on current geometry, supplies no tangential force and
does not use input angle or time to prescribe the output. Tooth contact
therefore determines progress along the retained path. The analytical
rolling path in `profile.js` is used for measurement, not as a motion driver.
The support is idealized hardware, with no claimed physical retaining track
or roller in the visible model.

Historical designs provide an analogy for retention: Wilson's
[1916 endless-rack patent](https://patents.google.com/patent/US1169221A/en)
uses shaft-mounted plates, balls and grooved tracks to maintain engagement.
That patent uses a different, internal-rack construction. It supports the
general need to consider retention, not an assertion that Brown's movement
contains those particular hidden parts.

The default solver uses gravity, frictionless tooth contact, 0.5 ms steps,
2 ms contact response, discrete integration, exact constraint inertia and
Newton solving. Moving-solid mass and full inertia use a uniform density
normalized to rack-family mass 1. Native collision geometry comprises 332
pinion and 521 rack convex cells. All 8,172 compiled vertices agree with the
visible geometry within 0.00000594 source pixel. The bearings and other
hardware are checked separately rather than used as native collision pairs.

Ten complete circuits, or eighty native seconds, retain rack travel from
−1.96798724 to +1.96799078 world units and shaft travel from −0.87218105 to
+0.87199755. Maximum transmission error relative to the rolling path at the
actual input angle is 0.47388901 source pixel; normal path error is
0.10159328 pixel and native tooth penetration 0.02034283 pixel. The measured
unwrapped travel is 9.99993713 circuits, with no automatic resets.

| Two-circuit sensitivity trial | Transmission error, pixels | Normal path error, pixels | Penetration, pixels |
| --- | ---: | ---: | ---: |
| 0.25 ms timestep | 0.473608 | 0.098528 | 0.018139 |
| 192 gear samples, 4,096 cutter steps | 0.488804 | 0.095087 | 0.021959 |
| Friction 0.1, constant rack load +1 | 0.483481 | 0.130367 | 0.022551 |
| Friction 0.3, constant rack load −1 | 0.473727 | 0.141364 | 0.024364 |
| Retention 20,000, damping 141.42136 | 0.472783 | 0.084401 | 0.020924 |

All trials retain the full stroke and complete two circuits without resets.
These results qualify motion for the stated ideal support and tested loads;
physical scale, material friction, spring forces and force convergence are
not calibrated. With teeth disabled, zero gravity and stationary outputs,
the input spins while both output coordinates remain stationary. A separate
24-position check verifies zero tangential support power and the expected
normal restoring force.

The independent surface audit samples 33 poses through one circuit, making
1,583,474 vertex, edge-midpoint and triangle-centroid queries. It finds no
unintended intersections and verifies camera bounds. Maximum sampled tooth
penetration is 0.01083340 source pixel. Only working tooth regions receive
a soft-contact allowance. This sampling does not certify continuous
clearance, and the ideal engagement support has no physical hardware to
audit. The larger all-step native maximum is reported separately above.

Four mechanism tests and nine shared engine/runtime tests pass. They cover
closed solids, collision geometry, normal-only support, contact-driven
circulation, exact restart, backward seeking, frame partitioning, section
toggle state preservation and native allocation disposal.

All fifteen final catalog views are inspected, including the source overlay,
both end transfers, straight-run meshes, journal, opaque guide, rear and
axial views. There are no page errors. Final headless playback averages
57.57 frames per second over 12.019434 wall seconds, advancing 12.016 native
seconds, or 99.97% of real time. Existing Three.js clock/shadow-map
deprecations and screenshot readback notices remain. The production build
and all 35 MuJoCo browser checks pass, including loading beneath a static
subdirectory, playback, section toggling and restart for 119.

## Reproduction and evidence

Bulk evidence is retained outside Git, with exclusive reports and archived
input hashes. The decisive `/dev/shm/119-` prefixes are:

- `baseline-a`: seven inspected views of the replaced model.
- `source-b`, `source-b-points`, `source-b-inspection`: independent readings and inspected point overlay.
- `fit-a`, `assembly-fit-a`: pinion-only and whole-assembly candidate comparisons.
- `comparison-a`: distances to actual rendered triangle edges.
- `dynamics-c`: ten circuits; `d` through `g` and `i`: sensitivity trials.
- `dynamics-h`: failed bare-mesh trial, with retention explicitly disabled.
- `clearances-a`: full nine-solid surface audit.
- `tests-b.log`, `build-a.log`, `browser-a.log`: final tests, build and full browser suite.
- `integrated-a`, `integrated-a-inspection`: final registered catalog views and review.
- `integrated-final-review-a.json`: evidence hashes and source compatibility.

Earlier `source-a` used a too-narrow lower-left rod window and produced no
readings there; `source-b` corrects it. Candidate `a` predates section view
and final gear-to-rod axial clearance. Candidate `b` has the final physical
geometry but predates the darker guide outline and final registration.
Native studies `c` through `h` and the clearance audit explicitly select
their retention value; they predate only the default-value change, display
status/note/outline changes and comments. Their physical construction and
effective simulation parameters remain compatible with the final model.
The final capture, comparison, stiffness trial, tests and production build
use the integrated source. The all-507 review remains active.

Use a fresh output prefix for every run, keep inputs unchanged while a study
is active, and run one owned browser at a time. Captures use the existing
Vite server at `http://127.0.0.1:5174`.

```sh
PROBE_PREFIX=/dev/shm/119-new-source node scripts/measure-endless-rack-source.mjs
TMPDIR=/dev/shm SOURCE_REPORT=/dev/shm/119-new-source.json PROBE_PREFIX=/dev/shm/119-new-comparison node scripts/compare-endless-rack-source.mjs
TMPDIR=/dev/shm DURATION=80 PROBE_PREFIX=/dev/shm/119-new-dynamics node scripts/probe-endless-rack-dynamics.mjs
TMPDIR=/dev/shm SIM_OPTIONS='{"retention":0}' DURATION=16 PROBE_PREFIX=/dev/shm/119-new-bare node scripts/probe-endless-rack-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/119-new-clearances node scripts/audit-endless-rack-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-endless-rack.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/119-new-views node scripts/capture-endless-rack-candidate.mjs
```
