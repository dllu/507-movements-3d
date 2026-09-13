# 091 — triangular eccentric valve motion

The ordinary `#/movement/091` route now uses MuJoCo contact to move a passive
vertical yoke. Only the cam shaft is actuated. The cam's two concentric arcs
produce a dwell at each end of the stroke, with a four-second shaft revolution.
The historical synchronous registry model remains available to old studies;
the application's asynchronous loader selects this reconstruction.

## Source reconstruction

The reference is Brown's [movement 091](https://507movements.com/mm_091.html),
`public/engravings/mm_091.png`, checked against PDF page 30 (printed page 26)
of the book scan. Brown describes intermittent rectilinear reciprocation used
for steam-engine valve motion. Dimensions below are fits to engraving ink,
not recovered manufacturing dimensions.

`scripts/measure-triangular-eccentric-source.mjs` fits the collar and hatched
shaft circles and a four-arc constant-width cam to 108 cam-outline readings.
One model unit represents 100 source pixels.

| Feature | Source pixels | Fit RMS, pixels |
| --- | ---: | ---: |
| Collar radius, 67 readings | 23.9387 | 1.3028 |
| Shaft radius, 50 readings | 14.7979 | 0.9224 |
| Cam constant width | 143.6138 | 1.6614 |
| Cam large concentric radius | 122.7051 | Same cam fit |
| Cam small concentric radius | 20.9086 | Same cam fit |

The common shaft axis is the collar center, (285.0825, 312.6829). The separately
fitted shaft center differs by about 1.60 pixels. The cam phase is 0.003370
radians; its maximum fitted outline residual is 4.1845 pixels. The small arc
is mostly hidden by the collar and is inferred from constant width and the
visible arcs. This is a mechanical interpretation of the source, not a claim
that every ink stroke describes an exact constant-width profile.

The profile consists of two shaft-centered arcs with radii summing to the
constant width, joined by two side arcs of that width. It gives a 101.7965-pixel
stroke and two 71.6341-degree dwells, each lasting about 0.796 seconds at the
default speed. The visible and collision cam outlines use the same 476 points,
with a maximum arc-to-chord error of 0.001 source pixel. The visible plate has
a real shaft bore.

The bowed yoke follows manually read stroke midlines, flattened with a
0.1-pixel cubic chord bound. Its original opening catches the rotating cam
between the quarter-turn poses. The corrected opening is the union of the
traced hole and a conservative cam-sweep envelope. This preserves the larger
source recesses and removes material only where needed. The maximum sampled
change from the traced hole is 3.3564 pixels, with a 3.4064-pixel upper bound
from bidirectional samples spaced at most 0.1 pixel apart. This comparison is
to the manually traced curve, not to all raster ink.

The envelope uses 2,048 shaft angles and a 0.01-pixel chord bound. Both cam
rotation and the ideal yoke-center displacement are Lipschitz-bounded by the
large cam radius. Offsetting the sampled convex hull by their combined
nearest-angle bound, the chord bound and 0.3 pixel of running allowance
contains the continuous sweep. The total hull offset is 0.6865 source pixel.
An independent test checks exact circular-arc support against every envelope
half-plane at angles between the construction samples. This envelope defines
static geometry; it never supplies output positions during playback.

The horizontal gold liners have 0.1 pixel of nominal clearance on either
side of the centered cam. They and the yoke are 0.28 unit thick; the cam is
0.22 unit thick, leaving the working faces wider than the cam. The collar sits
in front of both liners, so its overhang beyond the small cam arc is clear.

Brown depicts only rod stubs. The upper and lower rods extend 1.3723 and
1.3480 units from the yoke instead of the drawn 0.84 and 0.76. Both remain in
their bored guides throughout the stroke. The rear mounting frame, shaft
bearing, guides, rod extensions, flat rod attachment lands and all axial
dimensions are reconstruction assumptions. There is no ground plane.

## Dynamics and limits

There are two degrees of freedom, one actuator and three native collision
geometries: the input hinge, passive vertical slider, cam mesh and two liner
boxes. Their working surfaces coincide with the visible solids. The convex
cam collider fills the shaft bore, which cannot reach either liner. The
independently checked opening clears the remaining cam sweep.

Only motor control is written during stepping. Gravity settles the yoke for
one second before playback, then the clockwise input runs continuously.
Disabling cam collision makes the unsupported yoke fall; there is no hidden
prescribed displacement or repeated trajectory recording. Restart reproduces
the settled initial state and ongoing input velocity.

The ideal hinge and slider represent shaft retention and guides, including
restraint against output rotation. Visible guide and shaft bores have positive
clearance; their hardware does not add contact constraints. Mass and full
inertia come from the closed visible solids at uniform density, scaled to a
unit input mass. Friction 0.05, slider damping 0.1, motor gains 10000/200 and
a 4 ms soft-contact response are demonstration parameters. They do not
establish calibrated loads, contact forces or wear.

## Validation — 2026-09-13

Twenty-two focused mechanism, geometry, runtime and camera tests pass, along
with eight production browser tests and the build. Existing build warnings
concern the large application chunk and MuJoCo's browser-guarded Node `module`
import. No new browser errors or unexpected warnings occur.

Five mechanism tests cover constant width and dwell geometry, the conservative
opening, native passive motion, deterministic restart, frame-independent
stepping, resource disposal, ten uninterrupted turns, and refinement. Seventeen
native poses check fifteen closed solids and 786,244 independent surface
samples. Maximum sampled solid overlap is 0.004061 source pixel, confined to
cam/liner contact. Guide engagement and full-motion camera bounds also pass.

Forty-second probes cover ten turns:

| Timestep | Cam points | Maximum native penetration, px | Maximum offset from ideal support center, px | Maximum interior dwell travel, px |
| --- | ---: | ---: | ---: | ---: |
| 1 ms, production | 476 | 0.030687 | 0.130687 | 0.034894 |
| 0.5 ms | 476 | 0.022430 | 0.122431 | 0.020754 |
| 0.25 ms | 476 | 0.030056 | 0.130056 | 0.009046 |
| 1 ms, finer cam chords | 946 | 0.024082 | 0.124083 | 0.033614 |

Dwell measurements omit 0.08 radian at each transition boundary. At 10 ms
samples, maximum output differences are 0.080750 pixel for 1 versus 0.5 ms,
0.039634 pixel for 0.5 versus 0.25 ms, and 0.064773 pixel for cam-chord
refinement. RMS timestep differences decrease from 0.037723 to 0.018815 pixel.
The regression compares every 1 ms, finding maxima of 0.080770 pixel for
timestep and 0.065098 pixel for geometry refinement. These bound displayed
motion; peak soft penetration is not monotonic and contact-force convergence
is not established.

All twelve final views are inspected: source front and overlay, the four main
stroke positions, oblique, rear, contact and guide close-ups, desktop and
mobile. The existing mobile notes panel scrolls independently. An 8.2164-second
live capture records 494 frames, approximately 60 fps. Physics updates average
0.3555 ms per frame, with a 0.6001 ms 95th percentile. Production checks cover
nested static hosting, lazy WASM loading, pause/restart, mobile controls,
navigation during loading, failed asset recovery and standalone pilot disposal.

Final local evidence includes `/dev/shm/091-{coarse,fine,finer,geometry}.json`,
their three comparison reports, `/dev/shm/091-tests.log`, the build/browser
logs, and `/dev/shm/091-views{,-inspection}.json`. Capture and probe reports
retain source hashes and exclusive snapshots. Earlier thin-liner and stronger
motor trials are superseded by this state.

## Reproduction

```sh
node scripts/measure-triangular-eccentric-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-triangular-eccentric.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/091-browser-results
PROBE_PREFIX=/dev/shm/091-a node scripts/probe-mujoco-triangular-eccentric.mjs
PROBE_PREFIX=/dev/shm/091-b PROBE_OPTIONS='{"timestep":0.0005}' node scripts/probe-mujoco-triangular-eccentric.mjs
node scripts/compare-mujoco-triangular-eccentric.mjs /dev/shm/091-a.json /dev/shm/091-b.json
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/091-new-views node scripts/capture-mujoco-triangular-eccentric.mjs
```

The capture uses an existing Vite server on port 5174. Choose fresh output
prefixes when repeating studies. Bulk reports and images remain outside Git.
Browser captures must finish before changing source or rebuilding.
