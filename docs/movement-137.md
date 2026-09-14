# 137: expansion eccentric — reconstruction required

The [source engraving and caption](https://507movements.com/mm_137.html) show
a shaped expansion eccentric driving a forked arm with the valve rod attached
at its lower end. The current implementation incorrectly assumes a circular
cam and derives both roller-contact branches from that circle. Its green
kinematic tests consequently do not establish agreement with the source.

The contour review records 25 visible edge landmarks in the 525-pixel engraving.
It excludes the edge hidden behind either roller. The rendered model's circle
has centre (96,226), radius 85 pixels; its maximum radial error at these
landmarks is 23.94 pixels, with RMS error 9.40 pixels. An algebraic least-squares
circle fit still has maximum error 14.50 pixels and RMS error 5.75 pixels.
These discrepancies exceed the drawing's line width; changing only the circle
radius cannot reconstruct the illustrated profile.

- [Measured landmarks](../src/data/expansion-eccentric-outline.js)
- [Overlay](validation/137-outline-review.svg)
- [Numerical report](validation/137-outline-review.json)

Regenerate with:

```sh
node scripts/review-expansion-eccentric-outline.mjs
```

The script reads the current model dimensions, fits an independent circle to
the measured landmarks and emits the report and self-contained overlay.
The overlay has been rendered and visually checked against the engraving.
Landmarks remain manual measurements, not claims of subpixel accuracy.

Next, reconstruct the shaped cam and check the complete roller/fork contact
cycle. The measured roller centres are approximately (82,120) and (80,332),
rather than the preceding model's (81,116) and (80,336). Roller radii and the
occluded cam arcs must be reconciled mechanically; directly extruding a guessed
closed outline would not prove capture or clearance. Replace the circular
branch equations and fixed-angle handoff assumptions when implementing the
new contact model. Use offline contact simulation if the resulting fork
motion depends on preload or free travel between the rollers.

## Shaped-cam physics prototype

The reconstruction now interpolates the visible landmarks with a closed
centripetal spline, using explicitly inferred arcs behind the rollers. Tests
keep the visible-edge error below 0.15 pixels and verify that radial fan cells
form a valid star-shaped cam for collision geometry.

The measured roller centres and approximate 31/32-pixel radii are incompatible
with this cam through a full turn. A geometric fork-limit sweep finds about
23.5 pixels of interfering travel at the worst orientation. Moving each roller
12 pixels farther from the fork centreline restores a nonempty clearance
interval at all tested angles. This adjustment is a reconstruction compromise;
it is not a measured dimension. There is variable free travel between contacts.

The MuJoCo prototype drives only the cam. A passive fork with freely hinged
rollers follows under gravity from an assumed hanging fork/rod mass. It uses
triangular-prism cam cells and spherical roller contact proxies in the mechanism
plane. Mass, inertia, friction and the spacing adjustment are inferred. There
is no programmed fork-angle handoff or forced roller engagement.

Two 20-second probes, at 0.0005/0.00025-second timesteps and 192/384 cam cells,
run without resets. Maximum penetration is below 0.000711 world units (0.0711
engraving pixels). Comparing their settled fork motion from 8–19.99 seconds
gives a maximum roller-position difference of 0.141 pixels. Because timestep
and tessellation changed together, this is a combined sensitivity check, not
separate convergence certification. Source hashes and results are recorded in
[the prototype report](validation/137-physics-prototype.json).

```sh
node --test tests/expansion-eccentric-profile.test.mjs
PROBE_SECONDS=20 PROBE_REPORT=/dev/shm/137-coarse.json node scripts/probe-expansion-eccentric.mjs
SIM_OPTIONS='{"timestep":0.00025,"samples":384}' PROBE_SECONDS=20 PROBE_REPORT=/dev/shm/137-fine.json node scripts/probe-expansion-eccentric.mjs
node scripts/compare-expansion-eccentric-prototype.mjs
```

Next: separate refinement checks, bake the validated motion and replace the
browser's circular-cam geometry/contact implementation. Browser 137 remains
incorrect; do not advance to 138 yet.
