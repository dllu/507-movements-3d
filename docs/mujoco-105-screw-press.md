# 105 — weighted screw stamping press

The catalog route `#/movement/105` uses MuJoCo for a weighted handle, screw
and guided ram. Turning the handle lowers the ram onto a rigid blank; reversing
it lifts the ram. One turn down and back takes eight seconds. Brown's
[105 caption](https://507movements.com/mm_105.html) identifies a screw stamping
press converting circular motion to rectilinear motion, but supplies no load,
stroke, bearing detail or drive timing.

The previous model had the opposite thread handedness, round wire in place
of flat thread faces, ball-shaped handle weights, an added side guide and
incorrect frame and ram proportions. The replacement uses a complete square
helix and matching threaded nut, oblate bored weights, a bored handle head,
a surrounding ram guide and the measured C frame. The cropped lower frame
continues into an inferred base carrying an anvil and blank.

## Source comparison

`scripts/measure-screw-press-source.mjs` independently reads complete dark ink
runs from `public/engravings/mm_105.png`. One model unit represents 100 source
pixels. The script compares these readings with actual rendered vertices and
contours, and freezes its inputs alongside each report.

| Measurement | Result |
| --- | --- |
| Thread pitch | 28.34757 pixels |
| External thread width | 11.66517 pixels |
| Thread crest diameter | 39.42692 pixels |
| Ram diameter | 54.53819 pixels |
| Ram stroke | 28.34757 pixels |
| Frame contour, 139 ink readings | 1.48018 pixels RMS; 5.16664 maximum |
| True helix, 45 ink readings | 3.15212 pixels RMS; 6.82609 maximum |
| Left weight, 92 ink readings | 1.99507 pixels RMS; 4.36532 maximum |
| Right weight, 90 ink readings | 4.52077 pixels RMS; 7.49438 maximum |

The helix replaces straight drawn diagonals while retaining their measured
pitch, width and handedness. Flat orthographic registration also exposes the
engraving's perspective inconsistencies. Making the head, nut and ram coaxial
shifts their centers by approximately 0.82, 2.34 and 2.06 pixels, respectively.
Centering the weights on one straight horizontal handle shifts the left
weight up 2.36 pixels and the right down 7.06 pixels. The model does not claim
to trace all the drawn perspective edges simultaneously.

Eighteen closed solids retain open shaft, handle and guide bores. The screw
has a flange captured below the ram's removable cap, allowing it to turn
without rotating the ram. A hidden rear key fits the surrounding guide's
keyway. The screw/nut running clearance is 0.1 pixel radially and on either
flank; swivel and guide clearances are 0.3 pixel. Depths, the captured flange,
key, lower frame, anvil and blank are reconstruction assumptions.

Section view cuts the visible nut, guide and ram to expose the threads and
swivel. Presentation caps close the cuts. The complete hardware, mass and
physics remain unchanged when toggling the section.

## Dynamics and limits

The native model has a vertical ram slide and a screw hinge nested inside
the ram body. This nesting represents an ideal captured thrust bearing.
One joint equality enforces `ram travel = pitch × screw angle / (2π)`.
Only the screw hinge is actuated. The input torque is capped at 3 model units;
a sinusoidal reversing command requests 1.001 turns so that the working
face reaches the blank despite finite drive compliance.

The screw coupling, swivel and prismatic guide are ideal constraints.
Thread contact forces, friction, backlash and self-locking are omitted.
Independent geometry checks verify the finite mating surfaces, rather than
inferring their clearance from the ideal joints. Two native cylinders provide
actual ram/blank contact with the same flat working faces and radii as the
visible solids. The ram collision cylinder fills the hidden bearing cavity,
which never approaches the blank; mass and inertia come from the visible
hollow ram and its cap and key. The blank is rigid and does not deform.

Defaults use a 2 ms timestep, implicit integration, gravity, a 6 ms soft-contact
response and a uniform uncalibrated density normalized to unit screw mass.
These choices demonstrate motion and contact, not manufacturing loads.

## Validation

Four mechanism tests and eleven shared runtime, engine and camera tests pass.
Ten consecutive strokes check every native timestep. Each stroke reaches the
blank and returns, with 284 native contact records per cycle.

| Measurement | Bound observed |
| --- | --- |
| Ideal screw coupling error | 0.000252 pixel |
| Native ram/blank penetration | 0.002225 pixel |
| Sampled visible ram/blank penetration | 0.000113 pixel |
| Minimum key engagement in guide | 11.08320 pixels |
| Minimum thread end reserve | 29.82054 pixels |
| Minimum handle-weight clearance above frame | 11.73043 pixels |
| Travel difference, 2 versus 1 ms timestep | 0.011155 pixel |
| Travel difference, 1 versus 0.5 ms timestep | 0.005577 pixel |

Seventeen poses over the first full stroke pass 3,949,752 independent surface
samples. All parts remain inside the camera bounds, and the only sampled
intersection is the intended ram/blank contact. These are sampled checks,
not a proof of all continuous clearances. Removing the screw equality leaves
the stationary ram still while the handle turns with gravity disabled.
Separate positive and negative axial loads produce the input torque predicted
by virtual work. Seeking, restart and different render-frame partitions
reproduce the same state; disposal releases both native allocations.

Nineteen final views are inspected, covering source registration, full stroke,
rear and oblique views, thread, guide and swivel details, sections, and desktop
and mobile catalog controls. The first twelve images are byte-identical to
the inspected candidate views. Fog and ground are disabled and the complete
handle swing and lower frame fit the camera. Live headless playback averages
39.10 fps over 16.216 seconds, with 0.150 ms mean physics/update time and
0.200 ms at the 95th percentile. There are no page errors or unexpected
warnings; known Three.js deprecation/readback notices remain.

The production build and all 21 MuJoCo browser tests pass, covering lazy
loading beneath a static subdirectory, playback, restart, section toggling,
mobile controls, navigation races, asset retry and allocation disposal.
The build retains its existing large-chunk and guarded Node-import warnings.

Local evidence uses `/dev/shm/105-source-final.json`, `105-tests-b.txt`,
`105-final-views.json`, `105-build-a.txt`, `105-e2e.txt` and
`105-final-inspection.json`.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/105-measured node scripts/measure-screw-press-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-screw-press.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs tests/camera-resize.test.mjs
TMPDIR=/dev/shm npm run build
TMPDIR=/dev/shm npx playwright test tests/e2e/mujoco.spec.mjs --output=/dev/shm/105-browser-results
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/105-new-views node scripts/capture-mujoco-screw-press.mjs
```

The capture uses an existing Vite server on port 5174. Use fresh exclusive
prefixes and one owned browser at a time, keeping source and build files
unchanged during capture. Bulk artifacts remain outside Git.
