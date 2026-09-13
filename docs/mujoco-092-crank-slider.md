# 092 — ordinary crank motion

The catalog's `#/movement/092` route uses live MuJoCo joints. The input shaft
drives a passive connecting rod and crosshead through ordinary pin axes and a
horizontal slider. Four seconds per revolution makes the changing rod angle
and unequal stroke timing readable. The old synchronous registry model remains
available to historical studies; it is no longer selected by the application.

## Source and construction

The reference is Brown's [movement 092](https://507movements.com/mm_092.html),
stored in `public/engravings/mm_092.png`. Four inspected baseline views exposed
the straight bar spokes, small hub, oversized rod-length ratio, extra rotation
markers and large added base. The replacement follows the curved cast spokes,
measured circles and pin centers, rectangular crosshead and compact guides.

`scripts/measure-crank-slider-source.mjs` measures complete radial ink runs and
fits their midlines. The rod-obscured wheel sector is excluded. One model unit
represents 100 engraving pixels.

| Feature | Radius, source pixels | Fit RMS, pixels | Readings |
| --- | ---: | ---: | ---: |
| Wheel outside | 85.5466 | 0.3389 | 68 |
| Wheel inside | 71.2308 | 0.5974 | 68 |
| Hub | 25.0081 | 0.3096 | 81 |
| Shaft | 12.9520 | 0.3435 | 63 |
| Crank rod eye | 8.9513 | 0.2755 | 44 |
| Wrist rod eye | 8.2027 | 0.8789 | 63 |

The shaft uses the hub's center, (160.9762, 121.4698). The separately fitted
inner-wheel and shaft centers differ from it by approximately 0.90 and 0.35
pixel. The common physical axis is an interpretation of imperfect ink circles.
Likewise, each pin shares its rod eye's axis despite small differences between
their separately fitted circles.

The crank eye center is (186.1534, 165.2371), the wrist eye center is
(346.0666, 116.6035), the crank radius is 50.4923 pixels, and the connecting
rod length is 167.1450 pixels. The initial crank angle is -1.048772 radians.
The slider line is 4.8664 pixels above the shaft axis; the reconstruction
preserves this measured offset rather than assuming a centered slider.

The upper spoke opening is fitted to 58 scanline readings of its two curved
sides. A mirrored cubic pair, allowed a small angular offset, gives 0.2512-pixel
RMS against those readings. Six copies reconstruct the repeated cast openings.
This residual describes the fitted upper sides, not every visible or hidden
opening. The cubic tessellation bound is 0.05 source pixel. The outside rim has
256 segments, with about 0.0065 pixel of circular chord error. The wheel is a
single bored plate with actual spoke openings, and its hub extensions abut
the plate without duplicating its volume in the inertia calculation.

The rod is a tapered plate with two real eye bores. The measured pin radii are
3.6406 and 3.7040 pixels; each eye has 0.15 pixel of radial running clearance.
Small pin heads retain the rod axially. The rod clears the front hub, shaft
tip, crosshead and guide faces. A rear shoe runs between the horizontal rails,
and a bored rear support connects the shaft bearing to the guide frame.
Guides have flat completed ends in place of the engraving's break marks.

The guide and block outlines use manually read stroke midlines. Repeated
spokes, concentric axes, the rod's tangent outline, guide shoes, pin heads,
rear support, all thicknesses and running fits are reconstruction assumptions.
The viewer discloses the added hardware and ideal joints. There is no ground
plane, and fog is disabled by the shared viewer.

## MuJoCo model and limits

There are three joint coordinates: the input hinge, a rod hinge at the crank
pin, and the crosshead slider. A site-to-site wrist constraint closes the loop,
leaving one mechanism degree of freedom. Only the input hinge has an actuator.
MuJoCo supplies all rod and crosshead poses during playback. The analytical
crank law is used for initialization and independent checking, not to set
passive coordinates while stepping.

The wrist closure and other joints idealize bearings and guide retention.
This reconstruction does not add collision geometries to simulate bearing
play or pin impacts. The finite visible hardware is checked separately.
Disabling the wrist equality leaves a stationary crosshead stationary while
the input turns, demonstrating that its output is not prescribed.

Masses and full inertia tensors come from the closed visible parts with a
uniform density scaled to unit input mass. Gravity, joint damping, position
motor gains 10000/200, and a 3 ms equality response are demonstration settings.
The default timestep is 1 ms. Initial velocities describe a running mechanism;
Restart restores that same state. Playback integrates continuously without
a recorded cycle or reset at each revolution. These settings are not calibrated
force, friction or wear predictions.

## Validation — 2026-09-13

The final geometry passes 21 selected mechanism, geometry, runtime and camera
tests, nine production browser tests and the build. Existing build warnings concern the large
application chunk and MuJoCo's browser-guarded Node `module` import.

Three mechanism tests check deterministic restart and frame partitioning,
passive output, disposal, ten uninterrupted turns, pin closure, visible solid
clearance and timestep refinement. The thirty-three solid poses contain
fourteen closed solids. All 1,016,930 independent surface samples pass without
detected penetration. Every visible vertex remains in the motion camera bounds.
Exact offset-crank dead-center extrema also bound the entire guide shoe's
travel between the rails, including between sampled poses.

Over forty seconds, maximum crosshead error against the independent offset
crank law is 0.001898 source pixel, and maximum wrist closure error is
0.001857 pixel. Comparing every coarse tick, 1 versus 0.5 ms differs by at most
0.041816 pixel; 0.5 versus 0.25 ms differs by at most 0.020908 pixel. These are
checks of displayed motion and joint closure, not calibrated force convergence.

All twelve final views are inspected: source front and overlay, four main stroke
positions, oblique, rear, both pin close-ups, desktop and mobile. An 8.2163-second
live capture records 494 frames, approximately 60 fps. Updates average 0.17895 ms,
with a 0.30001 ms 95th percentile. There are no browser errors or unexpected
warnings. Production tests cover lazy loading under a static subdirectory,
pause/restart, mobile controls, camera resizing, navigation during loading,
asset failure recovery and standalone pilot disposal.

Final browser and image evidence is recorded after the fitted-spoke build.
The subsequent source-comment clarification changes no executable text; an
archive comparison records that distinction in the final source audit.
Earlier `092-candidate-b` and `092-final` images and tests describe the wider
spoke candidate and are superseded by the `092-fitted` evidence. Local evidence
is `/dev/shm/092-fitted*`, with the reproducible measurements in
`/dev/shm/092-source-fitted.json`.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/092-measured node scripts/measure-crank-slider-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-crank-slider.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/092-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/092-new-views node scripts/capture-mujoco-crank-slider.mjs
```

The capture uses an existing Vite server on port 5174 and preserves source
hashes with exclusive snapshots. Use fresh prefixes for repeated studies.
Only one owned browser runs at a time, and source/build files must remain
unchanged until it exits. Bulk reports and screenshots remain outside Git.
