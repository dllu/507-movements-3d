# 114 — Alternating double rack

The catalog uses `src/simulation/mujoco-double-rack/`. A continuously driven
half-pinion moves a passive horizontal frame through tooth contact. The frame
has nine teeth on each side. This replaces the former prescribed triangular
rack motion, instantaneous velocity reversal, upward-facing sector, invented
support posts and index marks. Ground and fog are disabled.

## Source geometry and corrections

Brown's [114 engraving and caption](https://507movements.com/mm_114.html)
show a mutilated pinion alternately engaging opposite racks in an oblong
frame. The engraving is the geometry reference; the website's later animation
uses different dimensions and a sixteen-position pinion.

Measurements use fixed-threshold ink midlines within explicit windows at
100 source pixels per world unit. The shaft axis is
(265.76656, 290.60894) pixels. The hub, shaft and bare pinion radii measure
24.73888, 15.17398 and 40.09546 pixels. The script preserves accepted readings,
measurement windows and rejected/unbounded stroke handling. Additional radial
windows measure both inner and outer frame ends independently of the model.

A fourteen-position pinion best fits the selected visible contour among
12–18-position diagnostic trials. Its radial-fit RMS is 5.76950 pixels;
that count is an inference, not an exact identification from the irregular
partial contour. Nine teeth on each rack are visible. Their separately fitted
pitches are 23.50833 and 24.16943 pixels. The working reconstruction uses a
single pitch of 22.77655 pixels (module 7.25 pixels, pitch radius 50.75 pixels).
The smaller pitch leaves clearance through the complete stroke. The hub and
shaft are made coaxial, correcting their slightly different drawn centers.

The frame outline retains the traced rod junctions and unequal end shapes.
A paired elliptical oblong defines the inner opening. Four closed solids form
the frame, pinion, shaft and hub. Depth, rod lengths, attachments and ideal
bearing/guide constraints are inferred from the flat drawing.

The ordinary working teeth are generated with a rounded rack cutter:
20-degree pressure angle, 0.8-module addendum, 1.45-module dedendum,
0.12-module cutter corners and 0.1-pixel rack tip clearance. These replace the
nearly square, uneven source teeth. End teeth require additional relief:
a simple 180-degree cut of the generated wheel reaches the opposite rack
before the working rack releases and jams.

The relief is a geometric construction using the swept mating racks, with a
0.2-radian rounded reversal window, 1,024 construction samples and 0.08-pixel
radial relief. The resulting pinion still has a half-circle toothed sector.
The construction path is **never applied to the native rack coordinate**.
MuJoCo resolves the rack's coasting, backlash and impact at each transfer;
its path need not equal the cutter's construction path. This is an inferred
end-tooth design, not a claim that Brown specified this profile.

The initial sector center is −5π/14 radians (−64.286 degrees). Copying the
source's approximately −0.65-radian sector angle while centering its frame
leaves insufficient travel at one end. The corrected phase moves the source
sector about 27 degrees toward the bottom. The engraving therefore cannot
be exactly superimposed at that initial pose. The fixed bare radius, overall
frame and hub remain closely aligned, and the phase correction is explicit.

Distances to actual rendered edges at the initial pose are:

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Frame top | 111 | 0.69015 | 1.35723 |
| Frame bottom | 104 | 0.78245 | 1.61042 |
| Left rod top / bottom | 31 / 31 | 0.46174 / 0.41892 | 1.12500 / 1.53996 |
| Right rod top / bottom | 26 / 25 | 0.64325 / 0.28219 | 1.62500 / 0.86862 |
| Left / right inner end extrema | 11 / 8 | 0.52767 / 0.33103 | 0.95995 / 0.74449 |
| Left / right outer curves | 38 / 40 | 1.14554 / 1.90034 | 2.57051 / 3.96947 |
| Left / right inner curves | 44 / 44 | 1.28624 / 0.97277 | 2.54398 / 2.24271 |
| Pinion contour | 70 | 6.41805 | 16.97268 |
| Hub | 72 | 0.50249 | 1.26869 |
| Shaft | 70 | 1.16849 | 3.80520 |
| Bare pinion arc | 24 | 0.58270 | 1.58834 |
| Uniform rack centers | 44 | 4.29011 | 7.52880 |

The larger pinion discrepancy includes the phase correction, tooth form and
end relief. Rack-center errors measure the regularized pattern, not the full
tooth silhouette. No exact source-copy claim is made for those features.

## Native mechanics and qualification

Two coordinates describe the pinion hinge and frame slide. Only the pinion
has an actuator. There are no gear equalities, prescribed rack positions,
state changes at handoff or periodic state resets. Removing collision contact
leaves the frame stationary while the pinion turns. The guide fixes the
frame's other five rigid-body freedoms; the shaft axis is fixed.

Mass and full inertia come from the rendered solids at uniform density,
normalized to frame mass 1. The eight-second input cycle uses a position servo
with velocity feedforward. Tooth contact is frictionless by default. The
0.5 ms timestep, 2 ms contact response, elliptic cone, implicit-fast integrator
and Newton solver resolve the short transfers. Material, scale, drive torque,
bearing loss, forces and structural deformation are not calibrated.

There are 756 convex collision cells decomposed from the actual frame and
pinion plates. All 8,028 compiled cell vertices match their construction
within 0.00000583 source pixel. The shaft and hub are checked separately for
hardware clearance. A single radial pinion boundary avoids the degenerate
cap triangles produced by an earlier Boolean root-circle join.

The final geometry completes ten cycles (80 seconds). Frame travel remains
between −102.55887 and +57.07916 pixels, with no accumulated tooth-phase error.
Maximum native penetration is 0.07185 pixel and maximum input angle error is
0.007072 radian. The two-cycle regression bounds working-stroke mesh error
away from the transfer windows to 0.13065 pixel; its largest frame step is
0.02875 pixel. These are motion checks, not contact-force convergence claims.

Two-cycle sensitivity trials on the final geometry give:

| Variant | Maximum penetration, pixels | Maximum input error, radians |
| --- | ---: | ---: |
| Half timestep | 0.05540 | 0.006907 |
| Double outline, cutter and relief resolution | 0.06458 | 0.006800 |
| Frame force −1 model unit | 0.06237 | 0.043377 |
| Frame force +1 model unit | 0.05376 | 0.042918 |

Both applied-force directions retain alternating travel, but shift one
turnaround by roughly three pixels. **Nonzero tooth friction is not qualified.**
At friction 0.1 the final mesh jams at a transfer; at 0.05 the input develops
a 2.30-radian lag. A coarser historical mesh appeared to tolerate 0.1, which
did not survive the final tessellation. This is a frictionless educational
reconstruction, not a manufacturable transmission or friction-force model.

## Verification and review evidence

All 13 mechanism, shared runtime and engine tests pass. They check closed
oriented solids, native cell parity, repeated passive contact drive, loss of
transmission when contact is removed, exact restart/backward seeking/frame
partitioning, and native allocation disposal.

The final independent surface audit makes 1,629,656 queries across 28 native
poses, including the ten-cycle penetration witness at 53.434 seconds.
It finds no unintended intersections; maximum sampled tooth penetration is
0.06901 pixel. Only points in the bounded tooth strips permit 0.15 pixel of
soft contact. Frame end walls, shaft and hub use a 1e-6-world-unit numerical
tolerance. All rendered vertices remain inside the swept camera bounds.
This sampling does not prove continuous clearance between poses.

The isolated production build passes in 18.72 seconds with the existing
large-chunk and guarded Node-import warnings. All twelve integrated images are inspected: source front and overlay,
front/oblique/rear assemblies, advance, both transfer limits, return, cycle,
and close views of the end teeth at both transfers. Complete views retain
the rods and full frame; close views intentionally crop the assembly.
The corrected sector phase and narrower regular rack tips are visible in
the source overlay. No ground, fog or unintended hardware overlap is visible.

The registered-factory capture records 715 frames in 12.02470 seconds:
59.46 fps, 99.92765% physical speed, 5.24 ms mean model update and 7.60 ms
p95. It reports no page errors. Existing Three.js deprecation and GPU
readback warnings remain. All 30 production MuJoCo browser regressions pass, including 114 playback,
exact restart, mobile controls and navigation beneath a static subdirectory.

Reports are outside Git under `/dev/shm/114-...`. `source-b` adds frame-curve
readings to `source-a`; `fit-a` records the tooth-count diagnostic.
`comparison-b` measures the final actual surfaces. Dynamics `a`–`g` record
rejected unrelieved sectors and undersized-sector trials. `h`–`n` develop
end relief and initial phase. `o`–`s` use the former Boolean root join;
`t` is the final ten-cycle geometry, `u` and `v` refine timestep/mesh,
`w` and `x` reverse applied force, and `y`/`z` expose friction failure.
Historical runs preserve their source archives; later metadata changes are
not represented as if they had been present in those runs.

`tests-a` records the rejected degenerate root join; `tests-b` records all
13 passing checks. `clearances-a` rejects that old join, `clearances-b`
checks the corrected solids, and `clearances-c` additionally separates
intended tooth contact from unintended frame-wall contact. `baseline-a`
has all seven views inspected. Of the early `candidate-h` images, only
source-front, transfer and oblique are claimed as inspected.

Final visual evidence is integrated-a.json and integrated-a-inspection.json.
The build is 114-integrated-build-a; 114-integrated-playwright.config.mjs
and 114-integrated-server.mjs serve it on port 43917 at both / and /portable/.
The final manifest, 114-integrated-final-review-b.json, freezes the
implementation, tests and review notes and records build/evidence hashes
and historical source changes. The earlier manifest predates the completed
browser-result documentation and is retained as historical evidence.

Use fresh output prefixes; scripts freeze input bytes and refuse to overwrite
evidence. The browser capture uses the existing Vite server at port 5174.

```sh
PROBE_PREFIX=/dev/shm/114-new-source node scripts/measure-double-rack-source.mjs
SOURCE_REPORT=/dev/shm/114-new-source.json PROBE_PREFIX=/dev/shm/114-new-fit node scripts/fit-double-rack-source.mjs
SOURCE_REPORT=/dev/shm/114-new-source.json PROBE_PREFIX=/dev/shm/114-new-comparison node scripts/compare-double-rack-source.mjs
TMPDIR=/dev/shm DURATION=80 PROBE_PREFIX=/dev/shm/114-new-dynamics node scripts/probe-double-rack-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/114-new-clearances node scripts/audit-double-rack-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-double-rack.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/114-new-views node scripts/capture-double-rack-candidate.mjs
```

`SIM_OPTIONS` supplies geometry/native overrides for dynamics and direct
captures; the catalog capture always uses the registered defaults. `TIMES`
changes the independent surface-audit grid.
