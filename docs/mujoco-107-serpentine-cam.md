# 107 — repeating serpentine-groove barrel cam

The catalog route `#/movement/107` uses native MuJoCo groove contact to drive
a passive rectangular rod through hanging guides. A barrel revolution takes
22 seconds and produces eleven complete reciprocations, each taking two
seconds. Brown's [107 caption](https://507movements.com/mm_107.html) specifies
uniform rectilinear reciprocation from a rotating grooved cam, without stating
the number of repetitions.

The previous reconstruction assumed six reciprocations, prescribed triangular
output motion with instantaneous reversals, and drew a raised black tube on
an uncut cylinder. Its ring guides, sliding sleeve and large added frame also
differed from the engraving. The replacement has a complete recessed groove,
measured rectangular hanging guides, a translating rod, a shaped follower
head, an ordinary crosspin and a rounded working pin.

## Source comparison and reconstruction

`scripts/measure-serpentine-cam-source.mjs` reads complete dark ink runs from
`public/engravings/mm_107.png`. One model unit represents 100 source pixels.
A manually selected path locates the groove; paired ink outlines are then
measured independently along local normals, yielding 167 centers and 334
outline readings. Integer repetition counts from six through fourteen are
compared using cylindrical projection, fitted stroke and phase, and four
reversal-blend widths. Eleven gives the smallest center residual. This is
an inference, not a repetition count established by the source.

The drawing's irregular groove spacing cannot be reproduced exactly with a
perfect cylinder, constant rotation and uniform strokes. The selected law has
linear working flanks and short C2 reversal blends. The normalized blend width
is 0.32 radians per half-cycle; uniform motion occupies 79.63% of elapsed time
and 88.66% of the travel in each stroke. Each reversal takes about 0.204 second.
The assembly phase is 0.166600 radians of barrel rotation.

| Measurement | Result |
| --- | --- |
| Barrel axial width | 76.72513 source pixels |
| Barrel diameter | 190.32091 pixels |
| Full follower stroke | 45.54289 pixels |
| Groove center horizontal residual, 167 readings | 7.13888 pixels RMS; 16.29649 maximum |
| Actual outer groove outlines, 334 nearest-distance readings | 3.31546 pixels RMS; 7.97171 maximum |
| Combined head and pin silhouette, 65 readings | 1.94295 pixels RMS; 8.00555 maximum |

The center metric compares horizontal position at the measured source height;
the outline metric measures Euclidean distance to actual rendered groove edges.
They are different measures and should not be interchanged. The source report
also compares the barrel, shaft, header, guides and rod with rendered vertices.
Centering the shaft shifts its drawn axis down 0.24406 pixel; centering the rod
on its crosspin shifts its drawn axis up 0.77051 pixel.

The median measured ink-outline gap is 5.1 pixels. A preliminary broad round
pin lost its unique wall constraint near the tight reversals under external
load: the cutter undercut the pitch curve. The final cutter radius is 1.1 pixels,
below the minimum spatial pitch-curve curvature radius of 1.27064 pixels.
The actual working pin radius is 1.07 pixels, leaving 0.03 pixel radial running
clearance. This narrower groove and pin are an explicit mechanical correction.
The drawn long working stem is shortened and bends back in depth from the
rod's front face to the working pin's plane, keeping its wide end clear of
the barrel. The rounded pin reaches source height 248.07 rather than the
drawn pointed end at 253.

Eleven closed solids retain the full shaft ends, short source rod, rectangular
guide bores and ordinary crosspin holes. The rod can retreat inside one guide
at a reversal, but retains at least 8.03050 pixels of engagement. Guide running
clearance is 0.3 pixel and crosspin-to-hole radial clearance is 0.15 pixel.
The crosspin is interpreted as a rigid fastening of head and rod. That
attachment, the working pin, bent stem, depths, ideal slide and shaft bearings
are reconstruction assumptions. The omitted bearing fixtures are not replaced
with an invented pedestal. Fog and ground are disabled.

## Contact and playback

The shared 106 groove generator sweeps the complete rounded pin footprint.
Radially ruled walls and a relieved floor form the actual visible groove.
Each land is divided into 2,112 convex six-vertex prisms that exactly fill its
rendered solid. The eleven identical sectors reuse 384 native mesh assets;
all 4,224 land instances remain present, plus the native capsule pin. No hull
bridges across the groove. The ideal output slide holds the pin depth, so the
floor has clearance and needs no separate collider.

The native model has an input hinge and an independent passive output slide.
Only the input is actuated; there is no output motor, spring or equality.
Both groove walls transmit motion through contact. Defaults use a 0.5 ms
timestep, implicit integration, Newton solver, gravity, friction coefficient
0.03 and a 4 ms soft-contact response. The input position drive requests
constant angular speed with velocity feed-forward. Uniform density is
normalized to unit barrel assembly mass; inertias come from the visible solids.
Material density, friction, compliance and drive torque are uncalibrated.
The model demonstrates motion and does not predict manufacturing loads.

Three.js follows native body poses. The shared runtime owns loading, fixed
steps, seeking, restart and disposal. Geometry repetition and optional profile
parameters extend the 106 helpers; all four existing 106 mechanism tests pass
after these changes.

## Validation

All nineteen native mechanism and shared runtime, engine and camera tests pass.
Ten full barrel turns cover 220 half-strokes over 220 seconds, checking every
native timestep. The input completes every revolution, both walls carry
contact and the output completes every stroke.

| Measurement | Bound observed |
| --- | --- |
| Follower deviation from machining law | 0.103872 source pixel |
| Speed variation over 100 ms intervals on uniform flanks | 1.87948% |
| Native pin/land penetration | 0.011396 pixel |
| Sampled visible pin/land penetration | 0.002334 pixel |
| Minimum rod/guide engagement | 8.03050 pixels |
| Travel difference, 0.5 versus 0.25 ms timestep | 0.176761 pixel |
| Travel difference, 0.25 versus 0.125 ms timestep | 0.142362 pixel |
| Travel difference with twice the angular resolution | 0.139215 pixel |

All eleven solids have closed edges, consistent outward normals and positive
volume. The 25,344 compiled collision-instance vertices agree with the rendered
lands within 0.00003 source pixel, and total prism volumes agree with the solids.
Forty-three poses combine 33 samples across the first complete output cycle
with subsequent sector boundaries across the first barrel revolution.
They pass 13,327,862 independent surface samples with only intended pin/land
contacts; all visible vertices remain inside the camera bounds.

Removing pin contact, with gravity and initial output velocity disabled, leaves
the follower stationary while the barrel rotates. Separate positive and negative
loads retain the stroke. Restart, seeking and different render-frame partitions
reproduce identical state; disposal releases both native allocations once.
Refinement covers two complete output cycles because the local contact geometry
repeats exactly; the separate ten-revolution test covers long playback.
These checks concern travel, not force convergence. Speed is measured over
100 ms intervals rather than individual contact impulses, and the sampled
geometry checks are not a continuous clearance proof.

All sixteen final views are inspected: source registration and overlay,
reversals and intermediate phases, oblique and rear views, groove, follower,
guide and crosspin details, and desktop/mobile catalog controls. The narrow
groove is less prominent than the drawn ink outlines; the source overlay
shows the stated corrections. Small shadow-map marks remain visible at extreme
close-up around the crosspin. Live headless playback averages 19.84 fps over
8.216 seconds at physical speed, with 16.805 ms mean physics/update time and
18.500 ms at the 95th percentile. Input progress is checked against the full
elapsed time. There are no page errors or unexpected warnings.

The production build and all 23 MuJoCo browser tests pass, including lazy
loading beneath a static subdirectory, playback, restart, mobile controls,
navigation races, asset retry and disposal. Existing large-chunk, guarded
Node-import and known Three.js warnings remain.

Local evidence uses `/dev/shm/107-source-final.json`, `107-tests-final.txt`,
`107-stress-b.txt`, `107-final-views.json`, `107-build-a.txt`, `107-e2e.txt`
and `107-final-inspection.json`. Bulk reports and images remain outside Git.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/107-measured node scripts/measure-serpentine-cam-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-serpentine-cam.test.mjs tests/mujoco-barrel-cam.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/107-browser-results-new
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/107-new-views node scripts/capture-mujoco-serpentine-cam.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh exclusive
prefixes and one owned browser at a time; hold source and build files unchanged
during capture. The baseline script uses the historical registry factory;
the final capture uses the production asynchronous loader.
