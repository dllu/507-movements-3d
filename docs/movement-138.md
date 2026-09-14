# 138: contact prototype; engraving reconstruction still required

The [source page](https://507movements.com/mm_138.html) includes a working 2D
animation. Its cam uses seven circular arcs and a pointed, vertically guided
follower. The current browser factory reproduces those arc parameters, but the
animation itself differs from the engraving. The caption only specifies a cam
imparting variable alternating rectilinear motion to a rod resting on it.

## Verified problems

The browser follower tip has its dimensions transposed. The animation's rotated
point has half-width 0.25 and height 0.5 in source units; the existing model uses
half-width 0.5 and height 0.25. A complete-turn finite-tip envelope check finds
up to 5.27 engraving pixels of interference, despite the old point-ray contact
test reporting zero gap. Correcting those proportions brings the polygonal-tip
envelope within 0.000402 pixels of the ideal point-ray result.

The source animation's ideal follower follows corners with instantaneous velocity
changes. At the old model speed, the largest downward velocity jump is 1.2674
world units/second. Positive normal-force calculations on smooth arcs cannot
establish continuous gravity contact across those jumps.

A separate landmark check against the engraving uses shaft centre (259,381)
and carrier radius 123 pixels. The animation-based profile misses the upper-right
corner by about 16 pixels, the left point by about 9 pixels and the bottom point
by about 6 pixels. These exceed the drawing's line width. The current browser
model is therefore still incorrect, and simply baking its profile is insufficient.

## Offline prototype

`mujoco-variable-cam/` now supplies a cam driven by a position actuator and an
unactuated vertical follower under gravity. The corrected triangular tip and
star-shaped cam use extruded convex collision cells. Contact is frictionless;
there is no scripted follower trajectory or assertion of permanent contact.

Physical dimensions are absent from the source. The prototype assumes one
engraving pixel corresponds to one millimetre, making the cam radius 123 mm.
Consequently one world unit is 0.05125 m and gravitational acceleration in those
coordinates is 191.4146341463. This explicit scale assumption avoids treating the
rendered 2.4-unit cam radius as 2.4 metres. Mass, guide friction and actuator gains
remain reconstruction assumptions; this is not a prediction for an identified
historical machine.

Four 24-second probes independently refine timestep (0.0005 to 0.00025 seconds)
and tessellation (64 to 128 cells per arc). All finish without resets. Settled
position sensitivities are below 0.219 engraving pixels. The finest run has
maximum MuJoCo penetration of 0.0363 pixels. A separate sampled finite-tip envelope
check finds maximum lift-off of about 0.509 pixels, explaining the small deviation
from the idealized animation. See the [hashed report](validation/138-physics-review.json).

An experimental offline geometry/bake path corrects the tip, removes bevels from
working surfaces, adds fitted bores and brings the rear support behind the rod.
It is **not registered in the browser loader**. Its provisional guide dimensions
and cam still come from the animation-based legacy factory. A test bake produced
an approximately 414 KB bundle and a continuous eight-second loop; that disposable
bundle is not committed or shipped while the contour review remains outstanding.

```sh
node scripts/probe-variable-cam.mjs
SIM_OPTIONS='{"timestep":0.00025}' PROBE_REPORT=/dev/shm/138-time-refined.json node scripts/probe-variable-cam.mjs
SIM_OPTIONS='{"samplesPerArc":128}' PROBE_REPORT=/dev/shm/138-mesh-refined.json node scripts/probe-variable-cam.mjs
SIM_OPTIONS='{"timestep":0.00025,"samplesPerArc":128}' PROBE_REPORT=/dev/shm/138-fine.json node scripts/probe-variable-cam.mjs
node scripts/review-variable-cam.mjs
node --test tests/variable-cam-prototype.test.mjs
# Experimental, writes an unregistered asset:
node scripts/bake-variable-cam.mjs
```

Next: trace the engraving's working edge and guide positions, rerun contact and
sensitivity checks for those dimensions, bake and wire the browser replacement,
and inspect packaged desktop/mobile playback. Do not advance to 139 yet.
