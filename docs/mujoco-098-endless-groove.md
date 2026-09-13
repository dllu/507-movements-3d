# 098 — endless-groove vibrating arm

The catalog route `#/movement/098` now uses a driven disk and a passive hinged
arm in MuJoCo. Contact between the disk's fixed cylindrical pin and both groove
faces produces the arm's motion. Only the disk is actuated. A revolution takes
four seconds; neither an output trajectory nor a groove-branch change is
prescribed. The historical synchronous registry model remains available to
older studies.

## Source geometry and interpretation

Brown's [movement 098](https://507movements.com/mm_098.html) describes irregular
vibration from a crank pin in an endless groove. The original site has no
animation for this movement. Its caption does not establish that the pin
completes a circuit of the groove.

Four baseline views were inspected. The old reconstruction shortened the
groove, selected its upper/lower branch from the input angle, and prescribed
the arm's position. Its front-facing groove floor also occupied the path of
the pin projecting from the rear disk. The new assembly places the groove on
the rear of the arm, as suggested by the dashed edges, and retains the measured
groove and crank proportions.

`scripts/measure-endless-groove-source.mjs` measures ink-run midpoints in
`public/engravings/mm_098.png`. Independent sampling stations and explicit
masks avoid the concealed disk edge, neck intersections, and hub/pin crossings.
One model unit represents 100 source pixels.

| Feature | Radius, pixels | Readings | Circle-fit RMS, pixels |
| --- | ---: | ---: | ---: |
| Disk | 163.0841 | 79 | 1.0884 |
| Disk hub | 29.7585 | 72 | 0.8448 |
| Disk shaft | 14.3913 | 85 | 0.7471 |
| Arm pivot boss | 32.1577 | 94 | 0.3695 |
| Fixed pivot shaft | 21.2273 | 102 | 0.5592 |
| Pin end | 5.9137 | 79 | 0.3826 |

The common input axis is the fitted hub center, (191.6760, 322.1477). The disk
is recentered by 4.1914 pixels to share this axis. The fixed arm pivot is
(443.6111, 316.6529), and the pin end is at (206.3359, 417.8936). These positions
give a crank radius of **96.8617 pixels**.

A shared capsule fit uses 261 points on both dashed groove faces. Its center is
(196.3112, 360.8138), its raster angle is −0.1693181 radian, its straight
half-length is 65.9395 pixels, and its inner/outer cap radii are 47.4724/67.0279
pixels. Residuals are 1.0370 pixels RMS and 5.2618 pixels maximum. A separate
187-point capsule fit to the body outline gives 1.0397 pixels RMS and 5.8702
pixels maximum. The tapered neck uses six manually read contour points.

The nominal contact assembly rotates the arm 0.1604° from the fitted source
pose. Its groove differs from the measured face points by 1.1954 pixels RMS
and 4.7855 pixels maximum. After the actual initial settling used in the viewer,
these distances are **1.2170 pixels RMS and 4.7511 pixels maximum**. The source
overlay shows these differences separately from the disk's recentering.

The measured pin orbit stays at least **25.5441 pixels** short of either radial
end of the groove's pitch path. It consequently reverses along the lower
branch rather than going around the whole loop. This preserves the drawing's
proportions without forcing a switch between disconnected configurations.
The viewer explicitly states this interpretation. It is not evidence that a
historical machine necessarily had this exact orbit or groove.

The inferred working pin has radius 9.7277 pixels, leaving 0.05 pixel nominal
clearance on each side of the 19.5555-pixel-wide groove. Its smaller end retains
the measured 5.9137-pixel radius. The pin is rigidly fixed to the disk and slides
against the groove; it is not modeled as a free roller. Its larger hidden
working diameter, axial construction, bearing support and all depths are
reconstruction choices.

## Solids and dynamics

Eleven closed solids form the input, rocker and fixed frame. The disk occupies
Z = −0.50…−0.30, the groove lands −0.12…0.14, and the connecting front cover
0.14…0.24. The pin ends at 0.11, with its small end at 0.13, leaving clearance
under the cover. The cover physically connects the inner island to the outer
arm. Section view hides only this cover; its mass and the physical motion are
unchanged. Turning Section view off restores the complete opaque arm.

The rear frame has finite shaft bores, and the disk shaft and arm pivot are
ideal hinges. Input and rocker mass and full inertia come from the closed
parts at uniform density, normalized to unit input mass. Abutting disk, hub
and shaft layers avoid double-counting their occupied volume. The complete
rear disk is retained, with fog and ground disabled. Camera bounds contain
the arm's full swing and rear support.

The two hinges are the only generalized coordinates. There are no equality
constraints, output actuators or return springs. The groove uses convex cells
merged from the actual rendered cap triangles by `mujoco/convex-plate.js`:
16 inner cells and 649 outer cells, preserving the complete groove and pivot
bore. Independent volume integration and compiled-vertex checks verify that
MuJoCo's mesh recentering does not move the contact surfaces.

The native pin capsule shares the visible cylinder's working radius. Its
straight middle intersects the groove's working depth; both remote rounded
ends remain within the finite cylinder. The planar joints prevent pin tilt.
Other hardware is checked as finite geometry rather than added as redundant
native collisions.

Defaults are a 0.5 ms timestep, implicit integration, gravity, 0.03 friction,
0.02 joint damping, a 4 ms soft-contact response and motor gains 10000/200.
Initial settling lasts 0.5 second. Initial velocities follow the instantaneous
assembly tangent so playback starts with the disk already turning. The
analytical lower-branch construction is used only for initialization and
diagnostics; subsequent output comes entirely from contact.

## Validation

Fifteen selected mechanism, runtime, engine and camera tests pass. Ten
uninterrupted revolutions (40 seconds) are checked at every 0.5 ms step:

| Measurement | Maximum |
| --- | ---: |
| Pin-center distance from the groove pitch path | 0.05399 pixel |
| Output difference from the analytical branch | 0.02088° |
| Native soft penetration | 0.00463 pixel |
| Sampled visible pin/face penetration | 0.00103 pixel |
| Contact-center distance from the rendered face, sampled every 10 ms | 0.00229 pixel |

Both groove faces participate: 164,260 inner and 987 outer contact records.
The arm ranges from −36.9763° to +9.8777°. Thirty-three poses pass topology,
camera and cross-family hardware checks, totaling 2,657,490 independent surface
samples. Only the intended pin/groove pair has bounded soft penetration. These
samples supplement the fixed axial clearances; they do not prove continuous
clearance between every possible pair of surfaces.

Across the same ten turns, halving the timestep from 0.5 to 0.25 ms changes the
arm angle by at most 0.02158°; 0.25 versus 0.125 ms changes it by 0.01406°.
Doubling each groove cap from 256 to 512 segments changes it by 0.01619°.
These bounds are comparable to the running clearance at the working lever
arm. They establish bounded position sensitivity, not converged impact forces.

Disabling pin contact and gravity leaves the initially stationary arm still
while the disk turns. Separate ±1 torque checks keep the pin in the groove.
Restart, backward seeking and different frame partitions reproduce exactly
the same state; disposal releases both native allocations. Section toggling
does not change the physics state.

The production build and all fourteen browser tests pass, including nested
static hosting, lazy WASM loading, play/pause/restart, section toggling, mobile
controls, navigation races, asset retry and native allocation disposal.
Sixteen final views are inspected: source front, overlay and full arm; four
front poses; oblique and rear; pin, pivot, pin side with and without the cover;
desktop, mobile and the scrolled mobile note. The side views partly occlude
the working pin behind the outer land, as expected; the more frontal pin view
exposes both working faces. Numerical checks establish the concealed cover
clearance. The complete rear disk and support remain visible when orbiting.

Live playback averages **35.48 fps** over 16.233 seconds in headless Chrome on
this machine. Mean update time is 2.385 ms, with 3.500 ms at the 95th percentile.
There are no page errors or unexpected warnings. Existing Three.js notices
and the build's guarded Node-import and large-chunk warnings remain.

Friction, compliance, density, strength and wear are uncalibrated. The source
fit, lower-branch interpretation, ideal bearings and inferred pin construction
define the scope of this reconstruction.

Local evidence is `/dev/shm/098-source-qualified.json`, `098-tests-a.txt`,
`098-build-final.txt`, `098-browser-final.txt` and `098-final.json`. The separate
`098-final-inspection.json` records all inspected image hashes, the 26 frozen
source files and archives, and validation evidence hashes. Bulk artifacts stay
outside Git.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/098-measured node scripts/measure-endless-groove-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-endless-groove.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/098-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/098-new-views node scripts/capture-mujoco-endless-groove.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh artifact
prefixes, wait for each build/browser process to finish before the next one,
and keep source files unchanged during capture.
