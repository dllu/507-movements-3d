# 101 — hanging slotted lever and horizontal bar

The catalog's `#/movement/101` route uses a driven hanging lever and a passive
horizontal bar. MuJoCo contact between the lever's slot and the bar's fixed
cylindrical wrist produces the horizontal strokes. A complete oscillation
takes three seconds. The earlier model prescribed the bar's motion, stretched
the handle and added dwell intervals and decorative outlines.

Brown's [movement 101](https://507movements.com/mm_101.html) describes straight
bar travel produced by a vibrating slotted bar suspended from above. It gives
neither an input waveform nor a stroke angle. The reconstructed drive swings
sinusoidally through ±28.5092° about the downward vertical, taking the drawn
pose as one end of that symmetric swing. Straight travel does not imply uniform
speed: the bar accelerates and decelerates naturally through each stroke.

## Source measurements and corrections

`scripts/measure-slotted-bar-source.mjs` obtains independent ink-run midpoints
from `public/engravings/mm_101.png`. One model unit represents 100 source pixels.
Circle scans avoid the boss's neck; capsule scans omit the wrist and the
crossing bar edges. The narrow stems replace the axial arcs of the outer caps,
so those arcs are excluded from the outer-body fit.

| Feature | Readings | Fit RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Slot capsule | 188 | 0.4559 | 1.3056 |
| Slotted lever's outer body | 105 | 0.3658 | 1.0538 |
| Upper bar edge, including its slight slope | 110 | 0.4333 | 1.2771 |
| Lower bar edge, including its slight slope | 112 | 0.4024 | 1.5824 |

The shaft center is (205.3748, 161.1653), with radius 8.5625 pixels. The
17.5916-pixel pivot boss is recentered by 2.3051 pixels onto that axis. The
measured wrist is centered at (275.5536, 296.9247), with radius 8.4313 pixels.
The respective circle-fit RMS residuals for the shaft, boss and wrist are
0.3209, 0.4890 and 0.3545 pixels.

The measured slot center is (275.8289, 299.5926), its raster angle 1.0732174
radians, straight half-length 51.2714 pixels and half-width 8.0418 pixels.
The drawing therefore makes the wrist 0.3896 pixel wider than its slot on
each side. The reconstruction retains the measured wrist and moves each
wall outward **0.5896 pixel**, leaving **0.2 pixel running clearance per side**.
Its initial wrist position moves 1.0660 pixels to fit the corrected assembly.
The slot's offset from the pivot axis is retained.

The reconstructed slot matches the independent readings within **0.7453 pixels
RMS and 1.7235 pixels maximum**. The actual lever outline at the sampled outer
body matches within **0.3647 pixels RMS and 1.0538 pixels maximum**. These
measurements do not claim an automated fit of the complete stems or support.
The horizontal bar removes the small slopes of the drawn edges; its upper and
lower edges match their independent readings within 0.8801 and 0.4287 pixels
RMS respectively.

The drawn bar runs from X = 13 to 508 pixels, with guides at X = 46…79 and
367…401. A full symmetric lever swing would pull its right end out of the right
guide. The right end is extended **47.7569 pixels**; the left end and the guide
positions are retained. This leaves at least 6.5156 pixels beyond the right
guide during native playback. The cut-off lower stem receives a rounded end
near its drawn extent. Neck shape, handle end, hanger and all plate depths
remain reconstructed.

## Complete solids and native contact

The lever, pivot boss, bar, wrist, wrist end, fixed shaft, hanger, two bored
guides and four bolt heads are thirteen closed solids in three rigid families.
The lever is a single union of its outer capsule, neck, lower handle and boss,
with the complete slot and pivot bore removed. Its front boss abuts the plate.
The overhead support has a shaft bore and a straight upper rail.

The bar occupies Z = −0.24…−0.08 behind the lever at Z = 0…0.16. Its wrist
extends from −0.08 to 0.20, with the contrasting end at 0.20…0.22. Both guide
blocks have complete rectangular tunnels along X, with 0.3-pixel clearance
around the bar in Y and Z. No frame or ground intersects the moving lever.
Mass and full inertia tensors come from the actual closed moving solids at
uniform density, normalized to unit lever mass.

The native model has one input hinge, one passive horizontal slide, one input
position actuator and three contact geometries. There are no equality
constraints, output springs, output actuators or periodic state corrections.
Two finite boxes contained in the lever supply the exact straight slot planes.
The complete wrist sweep clears the unused rounded slot ends by a conservative
continuous bound of **19.1253 pixels**, so those ends need no separate contacts.

A sphere contained within the visible cylindrical wrist supplies its circular
working section. In this planar frictionless mechanism, the contact normal
and lever moment agree with the cylinder. The full visible cylinder is also
checked against the finite hardware; the wrist is fixed to the bar and is
not a freely rotating roller. The hinge and slide are ideal bearings, rather
than contacts against simulated bearing races or guide wear faces.

Defaults are a 0.5 ms timestep, gravity, implicit integration, a 2 ms soft-contact
response, 0.02 joint damping and input motor gains 10000/200. Input velocity
feedforward compensates the motor's damping. The initial bar position uses
the slot centerline, with both bodies initially stationary. All subsequent
bar motion comes from native contact. Sliding friction is zero; material,
friction and damping values are not calibrated to a built historical machine.

## Validation

Fifteen selected mechanism, runtime, engine and camera tests pass. Ten complete
swings, thirty seconds in total, are checked at every 0.5 ms step:

| Measurement | Maximum |
| --- | ---: |
| Wrist excess beyond the running-clearance envelope | 0.00594 pixel |
| Native soft penetration | 0.00594 pixel |
| Independently sampled visible penetration | 0.00041 pixel |
| Contact-center distance from the visible wall, sampled every 10 ms | 0.00154 pixel |
| Input angle tracking error | 0.11834° |
| Reverse travel within a complete bar stroke | 0 pixel |

The native horizontal stroke is 148.7134 pixels. Both slot walls participate,
with 21,380 lower and 23,205 upper contact records. Native position extrema
identify complete strokes; a separate monotonicity check catches intermediate
backtracking. Both guides retain the bar throughout all ten cycles.

Thirty-one poses pass closed-solid topology and camera checks. Their 935,316
independent surface samples find no unintended intersections; only the working
wrist/slot pair admits bounded soft penetration. The samples supplement the
explicit axial fits and continuous slot-end bound, without claiming a proof
of every possible hardware clearance.

Over ten swings, halving the timestep from 0.5 to 0.25 ms changes bar position
by at most 0.03573 pixel; 0.25 versus 0.125 ms gives 0.01792 pixel. The working
planes and circular section are exact native primitives, so collision-mesh
refinement cannot move those faces. These are position checks, not convergence
claims for impact forces.

Removing wrist contact leaves the initially stationary bar still while the
lever oscillates. Separate ±2 load checks with an almost stationary input
reach the corresponding slot walls. Frame partitioning, seeking and restart
reproduce the same state, and disposal releases both native allocations.

The visual study includes the source overlay, both stroke limits, intermediate
poses, rear view, wrist and pivot details, the completed handle, guide retention
and desktop/mobile layouts. Fog and the ground plane are disabled; the complete
motion fits the camera. The source comparison is padded beyond the original
page so the extended bar is visible there as well.
All sixteen final views were inspected. Playback averages 60.00 frames per
second over 12.216 seconds, with a mean physics update of 0.324 ms and a
95th percentile of 0.5 ms. The production build and all seventeen MuJoCo browser
checks pass, including playback, restart, navigation during loading and asset
recovery.

Local evidence is `/dev/shm/101-source-qualified-final.json`,
`101-tests-final.txt`, `101-final.json`, `101-build-final.txt` and
`101-browser-final.txt`. The separate `101-final-inspection.json` records
inspected image hashes, frozen sources and validation evidence. Bulk artifacts
remain outside Git.

## Reproduction

```sh
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/101-new-source node scripts/measure-slotted-bar-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-slotted-bar.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/101-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/101-new-views node scripts/capture-mujoco-slotted-bar.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh artifact
prefixes, keep one owned browser at a time, and leave source/build files
unchanged during capture.
