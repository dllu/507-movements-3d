# 094 — spiral-groove variable crank

The catalog's `#/movement/094` route uses a powered spiral plate and a passive
bolt constrained by a radial slot. MuJoCo contact changes the bolt's radius.
The radial plate is held during adjustment and rendered translucent so the
rear groove remains visible. An inward/outward adjustment takes eight seconds.
The old synchronous registry model remains available to historical studies.

## Source and reconstruction

Brown's [movement 094](https://507movements.com/mm_094.html) describes two
concentric plates, a spiral groove, radial slots and a bolt that changes its
distance from the center when one plate turns relative to the other.
The reference is `public/engravings/mm_094.png`. Four inspected baseline views
showed the old model's incorrect spiral-end orientation, heavy added rims,
rotation markers and large base. The first attempted baseline capture passed
an undefined cycle period and rendered an empty view; only the corrected
`094-baseline-valid` captures are evidence of that earlier model.

`scripts/measure-variable-crank-source.mjs` records raster ink midlines and fits
the main circles. One model unit represents 100 source pixels.

| Feature | Radius, pixels | Fit RMS, pixels | Readings |
| --- | ---: | ---: | ---: |
| Disk | 205.3113 | 0.7355 | 120 |
| Hub | 42.7818 | 0.4161 | 119 |
| Shaft | 24.8427 | 0.5003 | 85 |
| Bolt head | 19.5745 | 1.7052 | 82 |
| Bolt end | 10.5033 | 1.4235 | 80 |
| Inner terminal circle | 9.9820 | 1.1049 | 30 |

The common axis follows the hub center, (263.3579, 280.4258). The fitted disk
and shaft centers are approximately 0.57 and 0.28 pixel away. Concentricity
regularizes these imperfect ink circles. Both plates have the same completed
outside diameter; the engraving supplies one outside outline.

The spiral fit uses 107 pairs of visible dashed faces, excluding the radial
slots. Pairing both faces avoids confusing isolated dashes with the opposite
wall. Its centerline has 1.2286-pixel RMS against the paired radial midpoints.
The radial law, in source pixels with an unwrapped angle in radians, is

```text
r(t) = 179.255606 - 5.335641 t - 0.168971 t²
       - 6.446483 cos(t) - 0.797873 sin(t).
```

The source does not specify constant spiral pitch. This fit allows the modest
pitch variation and asymmetry visible in the engraving. It describes the
measured centerline, not the accuracy of every groove wall or hidden contour.
The main curve spans angles 1.15 to 13.7. A short tangent cubic completes the
inner curl at the separately fitted terminal circle, centered at
(275.8227, 206.2431). Its control points are reconstructed; its tessellation
has a 0.05-pixel control-hull error bound. The expanded terminal circle and
outer rounded end lie outside the demonstrated working range.

The six radial slots retain individually measured axes rather than assumed
equal spacing: 1.4386°, 62.2833°, 125.5113°, 181.4851°, 234.7170° and 302.0463°.
Paired normal scanlines fitted through the common hub center give RMS residuals
between 0.1880 and 1.1988 pixels. The script records rejected readings near
crossing groove dashes. Slot end centers are manual readings, and straight
sides with semicircular caps regularize their slightly bowed outlines.

The spiral's measured median radial face separation is 15.6 pixels. Its modeled
normal width is also 15.6 pixels. A reconstructed stepped bolt uses a 7.775-pixel
rear shank through that groove, while its measured 10.5033-pixel front shank
passes through the radial plate. The shoulder lies in the gap between the
plates. This preserves the narrow spiral instead of enlarging it to match the
visible bolt end. Each radial slot is widened to a uniform 21.0566-pixel opening,
changing its half-width by about 0.194 to 1.737 pixels. The assumed radial running
clearance is 0.025 pixel at each working face.

The bolt axis is placed at the intersection of the fitted groove and selected
radial line, so the drawn bolt center is regularized as well. The head and rear
washer retain the bolt axially. A bored rear bearing, crossbar and two outside
brackets hold the concentric assembly; their tabs attach to the held plate.
The stepped shank, support fixture, ideal bearing/guide constraints, all depths,
fits and terminal joining curve are reconstruction assumptions. The viewer
discloses the held plate, transparency, stepped bolt and slot correction.

The orange rear plate is the driver, the blue bolt head and washer identify the
output, and the gray plate and brackets form the held frame. Lambert shading
on the large plates reduces rendering cost while retaining their lighting and
shadows. Other hardware retains the shared material treatment. Fog and the
ground plane are disabled; the normal camera includes the complete fixture.

## MuJoCo model and limits

There are two joint coordinates: the input hinge and a passive radial slider
for the bolt. Only the hinge has an actuator. The bolt's guide is an ideal
joint; its finite front shank and radial slot are checked separately.
Working groove walls are split into convex prisms coincident with their visible
faces. Their angular extent lies inside 2 to 13.2 radians and contains the
entire selected 2.5-to-12.7-radian adjustment with margin. Unused rounded
terminal regions are omitted from contact geometry.

A capsule contained inside the stepped bolt represents its working rear shank.
Its straight middle has the same radius and overlaps the groove's axial layer.
With ideal planar joints, that gives the same working circular envelope while
avoiding unstable flat-end cylinder/mesh contacts. The capsule's rounded ends
are inside the visible metal; neither bolt tilt nor axial bearing play is
simulated. All visible finite hardware remains independent of that proxy.

Masses and full inertia tensors come from the closed visible input and bolt
families at uniform density, scaled to unit input mass. The default timestep is
1 ms, with an implicit integrator, gravity, motor gains 10000/200, friction 0.03
and a 4 ms soft-contact response. Initial settling takes 0.5 second, followed
by velocities for an already running adjustment. Only actuator controls change
while stepping; passive bolt positions are never overwritten.

Removing groove contact lets gravity pull the bolt outward while the input
continues its inward adjustment. Restart is deterministic and independent of
render-frame partitioning. Playback integrates continuously without a recorded
cycle or periodic reset. This demonstrates radius adjustment with one plate
held; tightening the bolt and subsequently operating the variable crank are
not simulated. Contact forces, friction, wear and material properties are not
calibrated predictions.

## Validation

The completed terminal curl and stepped bolt pass 15 selected mechanism,
runtime, engine and camera tests, ten production browser tests and the build.
The browser suite includes 094 playback/restart, nested static hosting and
the shared loading, retry and disposal checks.

Ten uninterrupted adjustments (80 seconds) are checked at every 1 ms step.
Both groove faces contact the passive bolt. Maximum radius error against the
fitted curve is 0.05471 source pixel, and maximum native soft penetration is
0.03043 pixel. Thirty-three poses pass topology and camera checks across all
14 closed visible parts. Their 2,773,362 independent surface samples find only
the intended bolt-neck/groove contact, bounded by 0.01744 pixel of overlap.
These sampled checks supplement the continuous radial-travel and guide bounds;
they do not establish continuous clearance for every hardware surface.

Comparing every coarse tick over the same 80 seconds gives maximum output
differences of 0.08603 pixel at 1 versus 0.5 ms, 0.06889 pixel at 0.5 versus
0.25 ms, and 0.07533 pixel when doubling the main spiral's 384 segments.
An earlier flat-ended cylinder contact model failed mesh refinement; the
contained capsule and stated running fit pass these final checks. Numerical
differences are separate from the larger uncertainty in source reconstruction.

Fourteen final views are inspected: the source front and overlay, four advancing
front views, oblique and rear views, bolt and terminal details, a side view of
the bolt, desktop, mobile and the scrolled mobile reconstruction note. The
complete fixture fits the catalog camera, the bolt shoulder lies between the
plates, and the inner curl follows the fitted terminal circle. Live playback
averages 37.58 fps over 16.23 seconds in headless Chrome on this machine, with
1.03 ms mean physics/update time and 1.40 ms at the 95th percentile. The capture
has no page errors or unexpected warnings. Existing Three.js deprecations,
readback notices and the build's large-chunk/guarded Node-import warnings remain.

Local evidence uses `/dev/shm/094-source-final.json`, `094-tests-final.txt`,
`094-build-fitted.txt`, `094-browser-final.txt` and `094-final.json`. The separate
`094-final-inspection.json` records inspected image hashes and verifies the
capture's frozen source snapshots. Earlier candidate captures, uniform-shank
trials and builds preceding the completed curl are superseded.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/094-measured node scripts/measure-variable-crank-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-variable-crank.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/094-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/094-new-views node scripts/capture-mujoco-variable-crank.mjs
```

The capture uses an existing Vite server on port 5174 and exclusive source
snapshots. Use fresh prefixes for repeated studies. Only one owned browser
runs at a time, and source/build files must remain unchanged until it exits.
Bulk generated evidence stays outside Git.
