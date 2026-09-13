# 097 — grooved heart cam

The catalog's `#/movement/097` route uses MuJoCo contact between a rotating
grooved cam and a cylindrical follower pin. Both groove faces drive the passive
horizontal bar. Only the shaft is actuated; there is no return spring or
prescribed output trajectory. A revolution takes four seconds. The old
synchronous registry model remains available to historical studies.

## Source reconstruction and interpretation

Brown's [movement 097](https://507movements.com/mm_097.html) describes a heart
cam similar to 096, except grooved. Its short caption does not specify exact
dimensions, the pin's construction or hidden supports. The old implementation
prescribed follower motion, added a large floor frame and rotation markers,
and used different shaft, bar and groove proportions. Four baseline views
are inspected, including the complete rear assembly.

This reconstruction follows the **engraved groove, with varying traverse
speed**. It does not claim an exactly uniform stroke. A constant radial-speed
construction differs visibly from the drawing's long faces. The measured
curve is regularized as a smooth symmetric radial fit, with zero velocity at
both reversals and positive radial progression between them. The source-fit
choice and varying traverse speed are explicit in the catalog note.

`scripts/measure-grooved-heart-source.mjs` records complete radial ink runs in
`public/engravings/mm_097.png`. One model unit represents 100 source pixels.
The disk, hub, shaft, follower eye and pin head have fitted radii 183.0646,
31.9074, 15.8028, 11.5095 and 4.5235 pixels. Their 113/107/119/60/75 readings
have 0.9532/0.8223/0.3237/0.4304/0.3066-pixel RMS circle residuals. The hub's
center, (226.9810, 282.4742), becomes the common shaft axis; the slightly
different drawn circle centers are regularized.

Both groove faces are paired at 135 angles, excluding the concealed inner
reversal and the outer nose. The resulting 270 face points remain independent
of the reconstructed profile. A six-coefficient radial cosine fit through
mode seven preserves the measured follower-eye radius and the manually read
outer reversal. It has a 2.2359-pixel radial centerline RMS. The finite groove
is obtained by offsetting that pitch curve along its normals. The median
normal width is 20.0117 pixels, accounting for the fitted slope.

The final 768-segment groove differs from the 270 face samples by **2.1721
pixels RMS and 7.1173 pixels maximum**. Circle fits and groove fits have
different evidence scopes; neither claims an exact match to every ink edge.
The source overlay exposes the residual differences and the reconstructed
outer nose. Seven-mode regularization also removes small drawing asymmetries
and joins both branches smoothly at the reversals.

The follower begins 44.2760 pixels from the shaft and reaches 174.9810 pixels,
for 130.7050 pixels of traverse. Its axis is raised **4.7648 pixels**, based
on the fitted eye center, to align with the shaft. The bar retains its measured
25-pixel diameter and 208.7431-pixel length from the eye to the drawn end.
Two compact bored guides accommodate the whole stroke without extending it.
The rounded eye's diameter is regularized to the bar's diameter.

The drawing brings the groove to the disk perimeter. The reconstructed disk
radius is enlarged **4.9221 pixels** to retain a 3-pixel outer wall beyond the
pin envelope. This completes the groove through the outer reversal. The floor,
inner island and outer land are separate closed solids with abutting depth
layers. A shaft bore passes through the floor and island; front and rear hubs
join the shaft assembly. The rear bearing frame has its own shaft bore.

The cylindrical pin is fixed to the bar and slides along the groove. Its
19.9117-pixel diameter leaves 0.05 pixel nominal clearance at each face. A
smaller ordinary stem passes through the bored bar eye and terminates in the
measured pin head. The pin's rear end clears the groove floor by one source
pixel. Pin construction, groove depth, wall thickness, bearing depth and guide
brackets are inferred; Brown does not establish a freely rotating roller.

All 14 visible parts are closed solids. Orange identifies the input, blue the
bar, brass the pin and gray the fixed supports. A darker groove floor shows
its depth. Shared matte materials preserve the complete surfaces. Fog and the
ground are disabled, and the camera contains the full traverse and rear frame.

## Native contact model

Two coordinates represent the shaft hinge and the follower slide. Both groove
faces are native collision surfaces. The pin and bar remain one rigid body,
so tangential contact slides and the ideal guide reacts the pin's moment.
No rolling constraint, spring, output motor or periodic state reset is used.
An ideal joint supplies the guide constraint; its finite hardware and running
clearance are checked separately.

The reusable `mujoco/convex-plate.js` starts with the actual rendered cap
triangles and merges only convex neighboring cells. It preserves both the
shaft bore and the complete groove, without simplifying their boundaries.
Compiled native vertices are checked after MuJoCo's recentering and rotations,
and decomposition volumes agree with the independently integrated visible
plates. The collision representation cannot fill the groove with a hull.

The pin's native capsule has the same working circular radius as its visible
cylinder. Its short middle overlaps the working axial layer, and its rounded remote ends
remain within the finite pin, clear of the floor. The ideal planar joint
excludes pin tilt. The visible floor remains a complete solid; the pin cannot
reach it under that joint. Input and follower mass and full inertia tensors
come from the closed visible hardware at uniform density, normalized to unit
input mass.

Defaults are a 0.5 ms timestep, implicit integration, gravity, motor gains
10000/200, friction 0.03, follower damping 0.02 and a 4 ms soft-contact response.
Initial settling lasts 0.5 second. Playback starts with the shaft already
turning and the follower at its inner reversal. Subsequent output is determined
by contact. Restart is deterministic across different render-frame partitions.
Disabling contact leaves the initially stationary bar still while the shaft
turns. Separate positive and negative load checks confirm positive drive in
both directions.

The finite running clearance permits small free motion when the working face
changes. Faceting and soft contact add small differences to the analytical
pitch curve. Friction, material density, guide compliance, strength and wear
are uncalibrated; this reconstructs the described grooved motion and its
engraved geometry, not a particular built machine.

## Validation

Fifteen selected mechanism, runtime, engine and camera tests pass. Ten
uninterrupted revolutions (40 seconds) are checked at every 0.5 ms step.
Maximum traverse difference from the fitted pitch envelope is 0.07732 source
pixel; maximum native soft penetration is 0.00618 pixel. The inner and outer
faces both participate, with 24,136 and 12,325 recorded contacts respectively.
Contact centers sampled every 10 ms remain within 0.00265 pixel of the actual
rendered working surfaces.

Thirty-three poses pass topology and camera checks across all 14 closed parts.
Their 2,081,580 independent surface samples find no unintended intersections.
These sampled checks supplement the explicit floor, hub, rim and guide fits;
they do not prove continuous clearance between every pair of hardware surfaces.
Searching both complete profile polygons at 720 pitch positions gives nominal
pin/face gaps of 0.04394–0.05407 pixel. The sampled curvature times groove
half-width stays below 0.227, away from the unit undercut limit. The fitted
stroke is monotonic between its two smooth reversals.

Over ten turns, 0.5 versus 0.25 ms changes bar position by at most 0.14762 pixel;
0.25 versus 0.125 ms changes it by 0.13121 pixel. Doubling the complete groove
resolution to 1536 segments changes it by 0.14305 pixel. These maxima are
comparable to the gap's full radial play: they establish a position bound at
the tested resolutions, not converged impact forces. The 384-segment trial
reached 0.15982 pixel in the first timestep comparison and was not retained.

The production build and all thirteen browser tests pass, covering lazy loading,
nested static hosting, playback, pause, restart, mobile controls, navigation
races, asset retry and runtime disposal. Fourteen final views are inspected:
source front and overlay, four front poses, oblique, rear, pin from two
directions, guides, desktop, mobile and the scrolled mobile reconstruction note.
The complete disk, groove, ordinary pin and rear supports are visible. The bar
remains in both guides at its inner limit and fits the full camera at its outer
limit. The normal source view and fitted overlay are recorded separately.

Live playback averages 30.22 fps over 16.216 seconds in headless Chrome on this
machine. Mean physics/update time is 4.004 ms, with 6.400 ms at the 95th
percentile. There are no page errors or unexpected warnings. Existing Three.js
deprecation/readback notices and the build's large-chunk and guarded Node-import
warnings remain.

Local evidence is `/dev/shm/097-source-qualified.json`, `097-tests-final.txt`,
`097-build-final.txt`, `097-browser-final.txt` and `097-final.json`. The separate
`097-final-inspection.json` records all inspected image hashes and verifies the
27 frozen source files and their archives. The earlier constant-speed candidate
is superseded; its source-front, overlay and pin images were inspected before
the groove fit changed. All executable source and test files remain unchanged
after the final numerical, build and browser checks.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/097-measured node scripts/measure-grooved-heart-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-grooved-heart.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/097-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/097-new-views node scripts/capture-mujoco-grooved-heart.mjs
```

The capture uses an existing Vite server on port 5174 and exclusive source
snapshots. Use fresh prefixes for repeated studies. Only one owned browser runs
at a time, and source/build files remain unchanged until it exits. Bulk evidence
stays outside Git.
