# 098 — endless-groove vibrating arm

The catalog route `#/movement/098` uses a disk-mounted crank pin that travels
around the entire oblong groove once per revolution. MuJoCo contact with both
groove walls drives the passive hinged arm. Only the disk is actuated; no
output trajectory, branch switch or periodic state correction is prescribed.
A crank revolution takes two seconds.

The previous source-sized crank returned along the lower side of the groove.
That behavior was incorrect and its earlier qualification is superseded.
Brown's [movement 098](https://507movements.com/mm_098.html) describes irregular
vibration from a crank pin in an endless groove.

## Closing the complete circuit

The groove is a capsule with circular ends. Relative to the arm pivot, its
pitch path reaches radial distances 128.0247 and 374.4000 source pixels. A
crank orbit must reach both limits to join the two sides of that path. Thus
its axis distance from the arm pivot is the mean of these limits, and its
radius is half their difference:

```
D - R = minimum groove radius
D + R = maximum groove radius
R = 123.1877 pixels
D = 251.2124 pixels
```

The drawn pin placement gave only a 96.8617-pixel crank radius. The corrected
crank radius is 26.3260 pixels larger; the input axis moves just 0.7826 pixel
toward the arm pivot. Both physical shafts, the disk and the rear bearing bore
use this corrected axis. The groove, arm outline and fixed arm pivot retain
their measured proportions.

Initialization intersects the corrected crank circle with the groove in its
source pose and selects the intersection nearest the drawn pin. This changes
the initial pin marker by −74.8421 pixels horizontally and +11.2815 vertically.
It is an assembly-phase change as well as a radius correction. The tangent at
that intersection initializes velocity; all later motion comes from contact.

At either radial extreme, the pin passes a mechanical dead center. Finite
clearance permits angular play there and the arm's inertia carries it through.
At a four-second physical period, gravity and sliding friction could reverse
the groove circulation in longer refined simulations. The retained two-second
period preserves circulation at 0.5, 0.25 and 0.125 ms timesteps and with doubled
groove resolution. Viewer speed controls scale playback time, preserving these
physical dynamics. There is no hidden output motor or phase-dependent force.

## Source reconstruction and solids

`scripts/measure-endless-groove-source.mjs` independently measures ink runs in
`public/engravings/mm_098.png`; one model unit represents 100 source pixels.
The 261 groove-face readings give a capsule centered at (196.3112, 360.8138),
with raster angle −0.1693181 radian, straight half-length 65.9395 pixels and
inner/outer cap radii 47.4724/67.0279 pixels. In the nominal initial source
pose, face residuals are **1.0370 pixels RMS and 5.2618 pixels maximum**.
These are source-pose measurements; the actual viewer also performs settling.
A separate 187-point body fit has 1.0397-pixel RMS residual. The neck uses six
manually measured contour points.

The complete disk has radius 163.0841 pixels. The input and fixed pivot shaft
radii are 14.3913 and 21.2273 pixels. The working pin radius is 9.7277 pixels,
leaving 0.05-pixel nominal clearance on either side of the groove. Its smaller
end retains the measured 5.9137-pixel radius. The hidden working diameter,
bearings, material density and depths remain reconstruction assumptions.

Eleven closed solids form the input, arm and fixed frame. The groove is on the
rear of the arm, consistent with the drawing's dashed edges. A complete front
cover connects the groove's inner island and outer land. Section view hides
that cover to expose the pin; its mass and dynamics remain unchanged. Turning
Section view off restores the complete opaque arm. The finite pin ends below
the cover and clears the rear disk/arm layers. Fog and ground are disabled,
and the camera includes the complete rear wheel and full arm swing.

## Native dynamics and validation

There are two hinges and one input actuator, with no equality constraints,
output springs or output actuator. Convex contact cells come from the rendered
groove plates, preserving both walls and the pivot bore. Independent volume
integration and compiled-vertex checks verify the same collision and visible
surfaces. The native pin capsule shares the visible cylinder's working radius;
its rounded ends stay inside the finite pin. Mass and full inertia are
integrated from the visible closed solids.

Defaults are a 0.5 ms timestep, gravity, implicit integration, friction 0.03,
4 ms soft-contact response, 0.02 joint damping and motor gains 10000/200.
Initial settling lasts half a second. Contact removal leaves an initially
stationary arm still with gravity disabled while the disk turns. Separate
±1 torque checks preserve full circulation. Restart, seeking and different
render-frame partitions reproduce the same state; disposal releases the
native model and data. Section toggling does not alter physics state.

All four mechanism tests pass. Ten uninterrupted crank revolutions are checked
at every timestep. Each revolution visits both straight sides and both end
caps, and the pin's accumulated angle around the groove center confirms one
complete circuit per turn:

| Measurement | Maximum |
| --- | ---: |
| Pin-center distance from the groove pitch path | 0.07901 pixel |
| Native soft penetration | 0.03027 pixel |
| Sampled visible pin/face penetration | 0.00103 pixel |
| Contact-center distance from the rendered wall, sampled every 10 ms | 0.00666 pixel |

The arm ranges from −14.4195° to +16.0402°. Both faces participate, with 19,446
inner and 13,320 outer contact records. Thirty-three poses pass topology,
camera and cross-family hardware checks across 2,660,506 independent surface
samples. Only the intended pin/groove pair has bounded soft penetration.
These checks supplement the axial fits; they do not prove every possible
continuous hardware clearance.

Ten-turn refinement independently checks complete circulation at every
resolution. Timestep differences are 0.34377° for 0.5 versus 0.25 ms and
0.32458° for 0.25 versus 0.125 ms. Doubling the cap resolution from 256 to 512
segments changes the arm angle by 0.36195°. Dead centers amplify the finite
running clearance into angular play. These position bounds do not establish
converged impact forces, nor operation at arbitrary physical speeds or loads.

Eighteen corrected views are inspected, including both rounded ends, both
straight sides, source overlay, full and sectioned arm, rear assembly, pin and
pivot details, and desktop/mobile catalog views. The pin is visible around the
whole groove and the complete rear disk remains in the camera. Live headless
playback averages 36.01 fps over 16.216 seconds, with mean update time 2.292 ms
and 95th-percentile update time 3.200 ms. There are no page errors or unexpected
warnings; existing Three.js deprecation/readback notices remain.

The final production build and all 15 MuJoCo browser tests pass, covering
nested hosting, lazy loading, play/pause/restart, section controls, mobile
controls, navigation races, asset retry and allocation disposal. The build
retains its existing large-chunk and guarded Node-import warnings.

Local evidence: `/dev/shm/098-corrected-source.json`,
`098-correction-tests-b.txt`, `098-corrected-views.json` and `098-corrected-inspection.json`. Previous lower-branch qualification artifacts are superseded.
The shared production-build and browser evidence is
`/dev/shm/097-098-corrected-build.txt` and `097-098-corrected-e2e.txt`.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/098-measured node scripts/measure-endless-groove-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-endless-groove.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/098-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/098-new-views node scripts/capture-mujoco-endless-groove.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh prefixes,
keep one owned browser at a time, and leave source/build files unchanged during
capture. Bulk artifacts stay outside Git.
