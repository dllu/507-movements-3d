# 097 — grooved heart cam

The catalog's `#/movement/097` route uses two Archimedean spiral flanks to
produce uniform advance and return, with short smooth reversals. MuJoCo contact
between the rotating groove and a cylindrical pin drives the passive horizontal
bar. Only the shaft is actuated; there is no output motor or return spring.
One revolution takes four seconds.

The previous harmonic fit reproduced irregularities in the engraving and gave
nonuniform travel. That interpretation was incorrect and is superseded here.
Brown's [097 caption](https://507movements.com/mm_097.html) identifies this as
the grooved version of 096; its reconstruction needs the corresponding uniform
travel law.

## Pitch law and finite pin

The measured inner and outer follower radii are 44.2760 and 174.9810 source
pixels. One model unit represents 100 source pixels. On each working flank,
pitch radius changes linearly with angle at 42.6918 pixels/radian. The two
flanks have opposite slopes. Their combined extent is 94.907% of a revolution.

As in 096, each reversal is rounded over ±0.08 radian rather than requiring an
instantaneous reversal of a massive follower. With `d = 0.08`, slope
`k = stroke / (π - d)` and `t = angle / d`, the inner blend is
`r = minimum + k*d*(t³ - t⁴/2)`. It joins the straight radial law with continuous
velocity and acceleration. The outer blend and return are mirrored copies.
The short blends are explicit exceptions to the Archimedean flanks.

Both groove walls are normal offsets from the pitch curve. At the concave
inner reversal, the outer offset folds over itself because the pin has finite
radius. Polygon union removes the fold, leaving the swept reversal pocket.
The complete groove has 1536 angular samples. Searching both complete wall
polygons at 720 positions finds minimum pin clearance 0.04434 pixel. The relief
pocket reaches 1.33755 pixels of clearance and remains within 0.11345 radian
of the inner reversal. It does not alter the working spiral flanks.

The groove retains its 20.0117-pixel width and a 19.9117-pixel working pin
diameter, with nominal 0.05-pixel clearance on each side. An outward applied
load can move the follower across the enlarged inner reversal pocket; ±1 load
checks bound that error below 1.4 pixels locally and 0.15 pixel elsewhere.
The default unloaded trajectory differs from the pitch law by at most
0.13188 pixel over ten revolutions.

## Source reconstruction and solids

`scripts/measure-grooved-heart-source.mjs` independently samples 270 groove-face
points from `public/engravings/mm_097.png`. The corrected spiral walls differ
from those ink readings by **8.3850 pixels RMS and 15.6413 pixels maximum**.
Those differences are required corrections to the drawn groove, not evidence
of an exact tracing. The source measurement no longer supplies harmonic
coefficients to the motion law.

The disk, hub, shaft, eye and pin-head measurements are retained. The bar axis
is raised 4.7648 pixels to pass through the shaft axis, and the disk radius is
enlarged 4.9221 pixels to retain a complete outer groove wall. The bar preserves
its measured 25-pixel diameter and 208.7431-pixel length. Both bored guides
accommodate its full 130.7050-pixel stroke. The fixed cylindrical pin has an
ordinary smaller stem through the bar's eye. Its rear end clears the groove
floor by one source pixel.

All 14 parts are closed solids. The floor, island and outer land occupy
abutting depth layers; shaft and guide bores remain open. The pin, guides,
bearings and hidden depths are reconstructed. Fog and ground are disabled.
The camera includes the full stroke, disk and rear support.

## Native dynamics and validation

The only coordinates are the input hinge and passive follower slide. Convex
contact cells are merged from the rendered plate triangles, preserving both
complete groove walls and the shaft bore. Compiled native vertices and
independently integrated plate volumes verify that collision geometry agrees
with the visible solids. The native pin capsule has the visible cylinder's
working radius, with its rounded ends contained inside the finite pin.

Defaults are a 0.5 ms timestep, gravity, implicit integration, friction 0.03,
4 ms soft-contact response and motor gains 10000/200. Mass and full inertia
come from the visible hardware at uniform density. Playback uses shared fixed
steps; seeking and restart reproduce the same state across frame partitions.
Disabling pin contact leaves the stationary follower still while the shaft turns.

Fifteen selected mechanism, runtime, engine and camera tests pass. Over ten
revolutions, checked at every step:

| Measurement | Maximum |
| --- | ---: |
| Follower error on the spiral flanks | 0.06615 pixel |
| Follower error including reversals | 0.13189 pixel |
| Native travel-speed error over 100 ms on the flanks | 1.218% |
| Native soft penetration | 0.02813 pixel |
| Contact-center distance from the rendered wall, sampled every 10 ms | 0.00822 pixel |

Both walls participate: 12,644 inner and 5,341 outer contact records. Thirty-three
poses pass topology, camera and hardware checks with 2,980,012 independent
surface samples and no sampled unintended intersections. These are sampled
clearance checks, not a proof over every possible configuration.

Halving the timestep from 0.5 to 0.25 ms changes position by at most 0.11836 pixel;
0.25 versus 0.125 ms gives 0.08961 pixel. Doubling the complete groove resolution
to 3072 samples changes it by 0.14356 pixel. These establish position sensitivity
at the running-clearance scale, not converged impact forces.

Fourteen corrected views are inspected: source front and overlay, the stroke
and return, rear and oblique assemblies, pin and guides, and desktop/mobile
catalog views. The source overlay exposes the geometric correction. The pin
remains inside the groove, the complete disk is visible, and the bar stays in
both guides at the inner limit. Friction, density and compliance are uncalibrated.

Live headless playback averages 28.86 fps over 16.216 seconds, with mean
update time 6.017 ms and 95th-percentile update time 9.100 ms. There are no
page errors or unexpected warnings. Existing Three.js deprecation/readback
notices remain.

The final production build and all 15 MuJoCo browser tests pass, covering
nested hosting, lazy loading, play/pause/restart, section controls, mobile
controls, navigation races, asset retry and allocation disposal. The build
retains its existing large-chunk and guarded Node-import warnings.

Local evidence: `/dev/shm/097-corrected-source.json`,
`097-correction-tests-b.txt`, `097-corrected-views.json` and `097-corrected-inspection.json`. Old varying-speed qualification artifacts are superseded.
The shared production-build and browser evidence for this correction is
`/dev/shm/097-098-corrected-build.txt` and `097-098-corrected-e2e.txt`.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/097-measured node scripts/measure-grooved-heart-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-grooved-heart.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/097-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/097-new-views node scripts/capture-mujoco-grooved-heart.mjs
```

The capture uses an existing Vite server on port 5174 and exclusive source
snapshots. Use fresh prefixes and one owned browser at a time. Source and
build files remain unchanged during capture; bulk evidence stays outside Git.
