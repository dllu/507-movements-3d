# 096 — uniform-traverse heart cam

The catalog's `#/movement/096` route uses MuJoCo contact to move a horizontal
bar and turn its roller against a return spring. Only the cam shaft is
actuated. A revolution takes four seconds and playback integrates continuously.
The old synchronous registry model remains available to historical studies.

## Source reconstruction

Brown's [movement 096](https://507movements.com/mm_096.html) describes a heart
cam imparting uniform traverse to a horizontal bar. The dotted circles and
radial divisions explain the curve's construction; they are not another
physical disk. The old model prescribed the bar trajectory and roller angle,
with a small hub, long bar, large frame and rotation markers. Four baseline
views and the enlarged source nose are inspected.

`scripts/measure-heart-cam-source.mjs` measures complete radial ink runs in
`public/engravings/mm_096.png`. One model unit represents 100 source pixels.
The construction circle, hub, shaft, roller and axle head have fitted radii
157.9080, 39.5536, 19.3958, 11.3516 and 5.0026 pixels respectively. Their
119/117/118/63/107 readings have 0.540/0.543/0.393/0.451/0.344-pixel RMS
circle residuals. The model uses the hub center, (245.1192, 280.2609), as its
shaft axis and regularizes the slightly different drawn circle centers.

The follower's initial horizontal distance from that axis is 51.3492 pixels.
Its outer distance is the construction radius plus the roller radius,
169.2596 pixels, giving 117.9104 pixels of traverse. The bar's axis is moved
**6.4159 pixels upward** to make the follower radial. The manually measured
bar diameter is 25 pixels. Its completed length extends **44.4684 pixels**
beyond the drawn end so that it remains in both inferred guides throughout
the stroke. These are explicit source corrections, not fitted hidden details.

The functional cam is the inward roller envelope of a symmetric pitch curve.
Its pitch radius changes linearly over **94.907% of the cycle**. Each reversal
has a 0.16-radian interval (about 0.102 second) in which a quartic blend takes
the velocity smoothly through zero, with continuous position, velocity and
acceleration. This avoids an instantaneous reversal of a massive follower.
The profile uses 768 segments and retains the source's main proportions.

The hand-drawn cam outline is not reproduced exactly. Manual landmarks
select thick outline strokes independently of the functional profile; radial
scans then record 124 ink-run midpoints, excluding construction-line crossings.
Their nearest distances to the reconstructed outline are **5.3714 pixels RMS
and 10.8898 pixels maximum**. A separate symmetric linear-radius fit to those
ink points has 5.8578-pixel radial RMS and is not a finite-roller motion law.
The source overlay exposes the difference. The catalog note explicitly states
the roughly 11-pixel cam correction and 6-pixel bar alignment change.

The ordinary axle passes through real bores in the brass roller and the bar's
rounded eye. The eye is behind the roller so its face remains visible from the
source direction. Front and rear pin heads retain the assembly. The round
bar, its spring collar and two bored guide brackets clear the rear frame.
The frame has a bored shaft bearing; the cam and both hubs also have shaft
bores. The main assembly contains 15 closed solids, including the spring.

Brown does not specify the return force or hidden construction. The added
compression spring, collar, guides, bearing frame, axle depths and cam
thickness are reconstruction choices. The visible capped spring follows
compression while preserving its numerically integrated wire length; its
radius varies slightly as pitch changes. It does not supply an independently
simulated elastic wire. Shared matte materials distinguish the orange input,
blue bar, brass roller and gray supports. Fog and the ground are disabled,
and the camera envelope includes the full traverse and rear hardware.

## Native mechanics and limits

Three native coordinates represent the cam hinge, horizontal follower slide
and roller hinge. Only the cam has an actuator. Native normal contact moves
the bar, and tangential friction turns the roller. The follower's ideal linear
spring supplies the return load; no output position, velocity or periodic
reset is imposed while stepping. Axles and guides are ideal joints, with their
finite visible hardware checked separately.

The cam collider comprises 39 convex pieces of its actual float32 outline,
without boundary simplification. Compiled MuJoCo vertices, including mesh
recentering and rotations, are independently checked against the visible
plate. The decomposition fills the inaccessible shaft bore. The roller uses
a capsule inside its outer envelope: its short cylindrical middle shares the
working circular boundary, and its remote rounded ends remain inside the
visible wheel's depth. It fills the pin bore, which the cam cannot reach under
the planar joint constraints. The roller retains its full visible bored form.

An initial cylinder collider passed one turn but became unstable in longer
timestep comparisons. The capsule avoids those flat-end contacts and passes
the repeated-turn checks below. The input, follower and roller mass and full
inertia tensors come from their closed visible hardware at uniform density,
normalized to unit input mass. The ideal spring is massless.

Defaults are a 0.5 ms timestep, implicit integration, gravity, motor gains
10000/200, friction 0.15, spring stiffness 5, spring reference coordinate -1,
and a 4 ms soft-contact response. Initial settling lasts 0.5 second. Playback
starts with velocities for an already rotating shaft and roller; a separate
test starts the roller at rest and confirms that contact spins it. Disabling
contact lets the spring pull the bar inward and leaves a resting roller still.
Restart reproduces identical state across different render-frame partitions.

The analytical pitch curve specifies geometry, initialization and comparison
values only. Native faceted contact produces small velocity fluctuations and
allows frictional slip. Exact no-slip rolling is not imposed. Spring stiffness,
friction, material density, bearing compliance and loads are uncalibrated;
this reconstructs the described motion rather than a particular built machine.

## Validation

Fifteen selected mechanism, runtime, engine and camera tests pass. Ten
uninterrupted revolutions (40 seconds) are checked at every 0.5 ms step.
Maximum traverse error against the pitch envelope is 0.01472 source pixel,
and maximum native soft penetration is 0.01370 pixel. On the uniform flanks,
50 ms averaged speed differs from the reference using the actual shaft speed
by at most 0.102 source pixel per second. Reversal intervals are excluded
from that uniform-speed check.

Thirty-three poses pass topology and camera checks across all 15 closed parts.
Their 2,269,142 independent surface samples find only intended cam/roller
soft contact, bounded by 0.00360 pixel of overlap. Additional checks cover the
complete profile against 720 desired roller positions, hub clearance, full-stroke
guide engagement, spring travel and constant integrated wire length. These
sampled hardware checks do not prove continuous clearance at every surface.

Over ten turns, 0.5 versus 0.25 ms changes bar position by at most 0.01971 pixel;
0.25 versus 0.125 ms changes it by 0.01309 pixel. Doubling the cam resolution
to 1536 segments changes position by 0.01274 pixel. Corresponding accumulated
roller-angle differences, expressed at the rim, are 0.30317, 0.12201 and
0.09262 pixel. Roller-spin sensitivity remains separate from the much smaller
traverse differences and from the uncertainty in inferred friction.

The production build and all twelve browser tests pass, covering lazy loading,
nested static hosting, playback, pause, restart, mobile controls, navigation
races, asset retry and runtime disposal. Fourteen final views are inspected:
source front and overlay, four front poses, oblique, rear, roller from two
directions, spring, desktop, mobile and the scrolled mobile note. The roller
face and ordinary axle are visible, the rear support clears the collar, and
the full moving assembly fits the ordinary camera. The source-aligned crop
intentionally retains the engraving's extent instead of fitting added hardware.

Live playback averages 59.94 fps over 16.216 seconds in headless Chrome on this
machine. Mean physics/update time is 1.249 ms, with 1.700 ms at the 95th
percentile. There are no page errors or unexpected warnings. Existing Three.js
deprecation/readback notices and the build's large-chunk and guarded Node-import
warnings remain.

Local evidence is `/dev/shm/096-source-final.json`, `096-tests-final.txt`,
`096-build-final.txt`, `096-browser-final.txt` and `096-final.json`. The separate
`096-final-inspection.json` records inspected image hashes and verifies all
28 frozen source files and their archives. The source measurement precedes
the final rear-support depth and catalog integration changes, which do not
affect its comparison.
The eleven inspected candidate views precede the rearward bar placement and
are superseded by the final capture. All executable source and test files
remain unchanged after the final numerical, build and browser checks.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/096-measured node scripts/measure-heart-cam-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-heart-cam.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/096-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/096-new-views node scripts/capture-mujoco-heart-cam.mjs
```

The capture uses an existing Vite server on port 5174 and exclusive source
snapshots. Use fresh prefixes for repeated studies. Only one owned browser runs
at a time, and source/build files remain unchanged until it exits. Bulk evidence
stays outside Git.
