# 093 — Scotch yoke crank motion

The catalog's `#/movement/093` route uses a MuJoCo wrist cylinder contacting
the two straight faces of a passive slotted yoke. Only the disk's shaft is
actuated. Playback takes four seconds per revolution. The earlier synchronous
registry model remains available to historical studies but is no longer
selected by the application.

## Source and construction

Brown's [movement 093](https://507movements.com/mm_093.html) shows a crank wrist
working directly in a horizontal slot, without a connecting rod. The reference
is `public/engravings/mm_093.png`. Four inspected baseline views exposed the old
model's extra crank arm, motion markers, large frame and incorrect proportions.
The replacement puts the measured wrist directly on the disk and reconstructs
the yoke as a closed plate with a real opening.

`scripts/measure-scotch-yoke-source.mjs` fits complete radial ink runs and records
straight-face scanline midlines. One model unit represents 100 engraving pixels.

| Feature | Radius, source pixels | Fit RMS, pixels | Readings |
| --- | ---: | ---: | ---: |
| Disk | 138.4805 | 0.5727 | 84 |
| Hub | 31.7681 | 1.3044 | 99 |
| Shaft | 17.8391 | 0.9247 | 79 |
| Wrist | 20.2258 | 1.2363 | 74 |

The common shaft axis follows the least-obscured disk fit, (265.9589, 300.6334).
The separately fitted hub and shaft centers are approximately 1.34 and 0.87 pixel
away. Concentricity is a reconstruction assumption. The wrist center is
(357.1035, 240.0511), giving a crank radius of 109.4420 pixels and an initial
target angle of 0.586628 radians. The stem axis is 2.0411 pixels to the right of
the shaft axis, preserving the source's small offset.

Twenty-five scanlines per face give median raster y coordinates of 202 and
276.5 for the yoke's outside, and 219.5 and 257.5 for its working slot.
The slot's measured 38-pixel height cannot contain the fitted 40.4515-pixel
wrist diameter. The reconstruction gives it a 40.6515-pixel opening, including
0.1 pixel of clearance per face. Nominally this moves the upper and lower faces
by 0.2254 and 2.8769 pixels relative to their measured medians. After settling
under gravity and motor load, the initial rendered faces are at 219.8681 and
260.5197: shifts of 0.3681 and 3.0197 pixels. This correction is disclosed in
the viewer.

Straight faces and semicircular ends regularize the slightly uneven engraving.
The capsule end centers are manual readings. The wrist center's complete
horizontal sweep stays over 11 pixels inside the endpoints of the straight
slot faces, so it cannot reach either rounded end in this mechanism.
The disk has 256 segments and the wrist 128, bounding their circular chord
errors below 0.011 source pixel. These geometric bounds do not claim that
every source contour has the same fit residual as the measured circles.

The original upper stem is only about 62 pixels long, too short to remain in
a stationary guide across the 218.884-pixel stroke. Completing it to 251.884
pixels makes that guide physically possible. The lower stem extends from
227.5 to 253.486 pixels. Both guides have real circular bores with 0.5 pixel
of radial running clearance. Their rear brackets meet a compact frame carrying
the shaft bearing. The front hub and shaft clear the moving stems in depth.
Completed stem lengths, guides, rear support, all depths, ideal axial retention
and running fits are assumptions; the engraving does not specify them.

The aligned source views deliberately use the engraving's page-sized crop,
which cuts off the added stem lengths. The normal zoomable viewer fits their
entire motion envelope. There is no ground plane, and the shared viewer
disables fog.

## Dynamics and limits

The native model has two joint coordinates: an input hinge and a passive
vertical slider. One position actuator drives the hinge. A wrist cylinder and
two boxes provide the only collision geometry. Their depths and working faces
coincide with the visible solids. The ideal hinge and slider supply bearing
and guide constraints; their clearances are checked on the separate visible
hardware rather than simulated as additional bearing contacts.

Mass and full inertia tensors come from the closed visible input and yoke parts
at uniform density, scaled to unit input mass. The default timestep is 1 ms,
with an implicit integrator, gravity, motor gains 10000/200, friction 0.05 and
a 4 ms soft-contact response. Initialization holds the source angle for one
second of settling, then supplies velocities for an already running mechanism.
Only actuator control is updated during stepping; passive output coordinates
are never overwritten. Restart repeats initialization exactly, and playback
continues across revolutions without a recorded cycle or periodic reset.

Removing wrist contact lets the yoke fall under gravity. Reversing gravity
transfers contact to the opposite working face. These counterfactual checks
demonstrate that the output responds to contact and loads. The settings are
demonstration assumptions, not calibrated predictions of friction, impacts,
force, wear or bearing play.

## Validation — 2026-09-13

Fifteen selected mechanism, runtime and camera tests, nine production browser
tests and the build pass. Existing build warnings concern the large application
chunk and MuJoCo's browser-guarded Node `module` import.

Four mechanism tests check native/visible face correspondence, complete guide
travel, passive behavior, reversed loading, deterministic restart and frame
partitioning, allocation disposal, ten uninterrupted turns and timestep
refinement. Thirty-three solid poses contain fifteen closed parts and pass
1,155,696 independent surface samples with no unintended intersections.
The only detected penetration is the intended wrist/yoke soft contact, bounded
by 0.003486 source pixel in those samples. All visible vertices stay inside
the camera bounds. Continuous travel bounds also keep both stems within their
guides and the yoke clear of the guide bodies between sampled poses.

Over forty seconds, maximum yoke-to-wrist vertical difference is 0.104658 source
pixel, including the 0.1-pixel running clearance. Native soft penetration is
at most 0.004657 pixel. Contact briefly releases by at most 0.037894 pixel,
for at most 20 ms; the tests bound those releases rather than requiring a
contact on every tick. Comparing output every coarse tick, 1 versus 0.5 ms
differs by at most 0.088236 pixel; 0.5 versus 0.25 ms differs by at most
0.043873 pixel. These are positional checks, not force convergence results.

All twelve final capture views are inspected: source front and overlay, four
main stroke positions, oblique, rear, wrist and guide close-ups, desktop and
mobile. An additional inspected mobile view verifies that the complete
reconstruction note is accessible by scrolling its existing explanation panel.
An 8.2163-second live run records 494 frames, approximately 60 fps. Updates
average 0.21863 ms with a 0.40000 ms 95th percentile. There are no browser errors
or unexpected warnings. Production tests cover lazy loading under a static
subdirectory, pause/restart, mobile controls, navigation during loading,
asset failure recovery and standalone pilot disposal.

Local evidence is `/dev/shm/093-final*`, `/dev/shm/093-mobile-notes*`,
`/dev/shm/093-source-final.json`, `/dev/shm/093-tests-final.txt`,
`/dev/shm/093-build-final.txt` and `/dev/shm/093-browser-final*`.
Earlier candidate images precede the corrected forward camera bound and
production-loader integration. The final capture preserves exact source hashes
and separate image-inspection evidence. Bulk artifacts remain outside Git.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/093-measured node scripts/measure-scotch-yoke-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-scotch-yoke.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/093-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/093-new-views node scripts/capture-mujoco-scotch-yoke.mjs
```

The capture uses an existing Vite server on port 5174 and exclusive snapshots.
Use fresh prefixes for repeated studies. Only one owned browser runs at a time,
and source/build files must remain unchanged until it exits.
