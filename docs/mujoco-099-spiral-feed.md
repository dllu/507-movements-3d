# 099 — spiral-guide drill feed

This reconstruction uses a reversing disk, a passive vertical feed rod and a
freely turning roller in MuJoCo. The roller runs between adjacent turns of one
face-mounted spiral rail. Only the disk is actuated; feed position and roller
rotation come from native contact. A feed-and-return cycle takes twelve seconds.

## Source and geometry

Brown's [movement 099](https://507movements.com/mm_099.html) identifies a spiral
guide on a disk as a drilling-machine feed. The drawing shows the feed assembly,
without dimensions or a reversing-drive construction. Four baseline views were
inspected. The old model prescribed the feed and roller spin and added a large
floor frame, a chuck, bit and rotation markers. The reconstruction follows the
drawn disk, follower eye, rod and lower guide; hidden support is placed behind
the assembly.

`scripts/measure-spiral-feed-source.mjs` reads radial ink-run midpoints from
`public/engravings/mm_099.png`. One unit represents 100 source pixels. Circle
fits give radii 204.1252, 48.2217, 28.4514, 33.1576 and 19.1962 pixels for the
disk, hub, shaft, eye and pin head. Their 113/89/118/87/120 readings have RMS
residuals 0.8285/0.6628/0.5758/0.4756/0.4653 pixel. The fitted shaft center,
(258.2156, 225.0878), becomes the common axis; the disk is recentered by 1.6545
pixels. The follower and bored guide are aligned with this axis; the nominal
eye position shifts 1.1531 pixels left and 1.0151 pixels up.

The spiral fit uses 487 independent line samples, excluding the hub, eye, neck
and open outer endpoint. An initial narrow sampling window omitted valid outer
readings and was replaced with a wider scan. The final radial law has one
periodic harmonic and a constant difference between adjacent turns:

```text
r(t) = 48.970777603 + 5.176892033 t
       + 1.192529843 cos(t) + 1.033177636 sin(t)   [source pixels]
angle(t) = −π/2 − t
```

This regularizes the drawing's unequal turn spacing while retaining its small
angular asymmetry. Radial fit residuals are 2.5337 pixels RMS and 7.2042 pixels
maximum. The radial pitch is 32.5274 pixels per revolution. The rail is a
3.4-pixel-wide strip, offset along the curve's normals, with a reconstructed
rectangular cross-section. Its roughly 4.5 turns terminate on the manually read
outer-end direction. Regularizing the pitch moves that endpoint 7.6319 pixels
outward. The viewer explicitly discloses the roughly eight-pixel correction.
The actual 3072-segment centerline matches these samples within 2.5315 pixels
RMS and 7.2014 pixels maximum.

The larger drawn circle is reconstructed as the nonrotating follower eye; the
inner circle is its journal head. A smaller working roller sits behind them
between the rail turns. Its constant diameter is chosen from the minimum
normal channel width, leaving running clearance across the complete feed.
Its working radius is 14.4398 pixels, and the resulting radial play ranges
from 0.1012 to 0.2409 pixel over 2881 sampled input positions.
The roller has a finite journal bore and an ideal hinge. Its head, journal,
working diameter, cross-sections and all depths are reconstruction assumptions.

The lower rectangle is a bored guide for the rod. It is lowered **5.5 pixels**
to clear the eye's neck at full extension. The rod retains its measured
25-pixel width and extends below the cropped drawing so it remains within the
guide at the inner limit; the extension adds 63.6774 pixels at the nominal
source pose. The input reverses with a 0.03-radian reserve at each open end of
the spiral. These endpoint reserves change feed travel by less
than one source pixel; they provide a finite margin beyond the roller contact.

Seventeen closed physical parts form the disk, follower, roller and frame.
The disk occupies Z = −0.26…−0.08, the rail −0.08…0.16, and the working roller
−0.07…0.25. The eye begins at Z = 0.28, clear of the roller. The rod passes
through a rectangular guide bore with 0.3-pixel clearance on each face. The
rear frame and shaft have finite bores and completed ends. Fog and the ground
are disabled, and camera bounds include the complete rod and disk.

Section view exposes the working roller by displaying half of the eye and
journal head. These alternate section surfaces leave the connection to the
rod visible. They are excluded from mass calculations; section toggling changes
only the rendering, and the complete physical eye remains part of the model.

## Native model

Three coordinates represent the input hinge, passive feed slide and roller
hinge. There are no output actuators, springs or equality constraints. The
complete spiral strip is decomposed from its actual cap triangles into convex
native cells (3082 at the default resolution). Independent volume and
compiled-vertex checks preserve the visible boundary through MuJoCo's mesh
recentering.

The roller's collision sphere has its equator at Z = 0.09, inside the rail's
working depth. That equator coincides with the visible cylindrical roller's
working circle. The poles stay within the roller's outer envelope; the native
proxy fills the inaccessible journal bore. Ideal planar joints exclude tilt.
A short capsule trial produced spurious normal torque in a friction-free
diagnostic. Sphere/mesh contact removes that error without prescribing spin.

Input, follower and roller mass and full inertia are integrated from the closed
physical parts at uniform density, normalized to unit input mass. Defaults are
a 0.5 ms timestep, implicit integration, gravity, 0.15 friction, motor gains
10000/200, 0.02 input/feed damping and a 4 ms soft-contact response. The roller
has only 1e−7 hinge damping. Initial settling lasts half a second; playback
starts with the disk already turning.

The external motor command reverses smoothly over twelve seconds. It does not
establish a constant feed speed. The spiral envelope is used for initialization,
roller sizing and diagnostics, and never writes the output during playback.
Gravity normally loads the outer winding; an opposing applied load selects the
inner winding. Bearings, friction, density, compliance, strength and wear are
uncalibrated reconstruction assumptions.

## Validation

The ordinary catalog route now loads this model through the shared asynchronous
MuJoCo loader. Fifteen selected mechanism, runtime, engine and camera tests pass.
Ten uninterrupted feed-and-return cycles (120 seconds) are checked at every
0.5 ms step:

| Measurement | Maximum |
| --- | ---: |
| Feed-center departure from the allowed spiral envelope | 0.00233 pixel |
| Native soft penetration | 0.00381 pixel |
| Sampled visible roller/rail penetration | 0.00168 pixel |
| Contact-center distance from the rendered rail, sampled every 10 ms | 0.00157 pixel |

The roller center ranges from 66.6770 to 177.6825 pixels below the shaft.
Gravity loads the outer winding, giving 226,495 outer contact records in this
run. Separate positive and negative applied-load tests reach the inner and
outer winding respectively. Thirty-three poses pass topology, camera and
cross-family hardware checks, totaling 9,192,492 independent surface samples.
Only the intended roller/rail pair has bounded soft penetration. These samples
supplement the fixed axial clearances and guide-envelope checks; they do not
prove continuous clearance between every possible pair of surfaces.

Across the same ten cycles, halving the timestep from 0.5 to 0.25 ms changes
feed position by at most 0.01108 pixel and roller-rim position by 0.57221 pixel.
The 0.25 versus 0.125 ms differences fall to 0.00540 and 0.18009 pixel.
Doubling the rail resolution from 3072 to 6144 segments changes them by
0.00436 and 0.26600 pixel. A coarser rail trial had greater cumulative rolling
phase sensitivity; the finer default bounds it below a source pixel over this
run. These are position-sensitivity bounds, not converged impact forces.

Disabling roller contact and gravity leaves the initially stationary feed
still while the disk turns. With normal-only contact and zero initial roller
speed, the roller does not develop spurious spin. Restart, backward seeking
and different frame partitions reproduce exactly the same state; disposal
releases both native allocations. Section toggling leaves physics unchanged.

The production build and all fifteen browser tests pass, including nested
static hosting, lazy WASM loading, play/pause/restart, section toggling, mobile
controls, navigation races, asset retry and native allocation disposal.
The initial browser test exceeded its five-second startup deadline. A separate
production probe measured 8.641 and 8.428 seconds for first and repeat loading,
without page errors; 099's startup assertions now allow fifteen seconds.
The existing assembly indicator remains visible during compilation.

Sixteen final views are inspected: source front, overlay and half section;
outer, inner and return poses; oblique and rear; roller, guide, rod end,
roller side with and without the section; desktop, mobile and scrolled mobile
notes. The source comparison uses an orthographic camera at engraving scale
and deliberately shares its lower crop; ordinary views include the full rod.
The half section exposes the journal and working roller while retaining the
eye's connection to the rod. The outer winding occludes part of the roller
in oblique views. Guide close-ups show the neck clearing its upper face and
the rod extending beyond its lower face at the opposite limit. The complete
rear wheel and support are visible when orbiting.

Live playback averages **28.16 fps** over 24.216 seconds in headless Chrome on
this machine. Mean update time is 9.873 ms, with 14.000 ms at the 95th
percentile. Capture initialization takes 8.259 seconds. There are no page
errors or unexpected warnings. Existing Three.js notices and the build's
guarded Node-import and large-chunk warnings remain.

Local evidence is `/dev/shm/099-source-final.json`, `099-tests-final.txt`,
`099-build-final.txt`, `099-browser-b.txt` and `099-final-b.json`. The separate
`099-final-inspection.json` records all inspected image hashes, the 26 frozen
source files and archives, and validation evidence hashes. Bulk artifacts
remain outside Git.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/099-measured node scripts/measure-spiral-feed-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-spiral-feed.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/099-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/099-new-views node scripts/capture-mujoco-spiral-feed.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh artifact
prefixes, wait for each build/browser process to finish before the next one,
and keep source files unchanged during capture. The selected numerical suite
is CPU-heavy; it takes roughly eighteen minutes on this machine. Finish it
before recording browser performance.
