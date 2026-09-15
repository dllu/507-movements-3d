# Movement 174: twin-jaw bench clamp — source review open

The browser now uses a 16-mesh reconstruction and a 278,000-byte geometry-and-
motion bake. Both jaws respond passively to board contact. A six-second cycle
withdraws and reinserts the board; the old forced jaw angles, decorative
outlines, white indices and floating contact markers have been replaced.

The [original page](https://507movements.com/mm_174.html) has no enabled animation.
The engraving and caption are the source reference.

## Contact and cycle

Only board X is actuated, with an inferred force limit of 10. The jaws turn on
ideal fixed hinges. Board Y is free, while board orientation is held to represent
the operator guiding it. Allowing sideways motion is essential: a fixed Y guide
in the first study let the lower jaw carry the clamp alone. The current model
establishes contact with both jaws.

The [push study](validation/174-native-study.json) includes two timesteps,
frictionless normal contact and disabled contact. Geometric contact holds the
board even without friction; disabling contact lets it pass through while the
jaws retain their initial angles. Masses, damping, force, axial layers and
board orientation are reconstruction assumptions.

Adjacent collision triangles are merged only where their union is convex.
This reduces 316 prisms to 75 while preserving area within 9e-16 per jaw and
retaining the traced boundary. It removes the recurring jitter caused by
redundant contacts. Pivot holes are omitted from these collision solids because
the board does not approach the pivots; the displayed holes and screw hardware
are checked separately.

The [cycle qualification](validation/174-native-cycle.json) simulates three
withdrawal/reinsertion cycles at 0.0005 and 0.00025 seconds. The final cycle
repeats in position and velocity to numerical precision. Maximum transient
coarse/fine differences are 0.00104 radians at the upper jaw, 0.00210 at the
lower jaw, 0.000962 in board X and 0.000312 in board Y. No negative native
contact distances were recorded, with a small contact margin enabled.

## Visible assembly and checks

The replacement has real pivot bores, support sleeves, washers and recessed
screw-head slots. The board and bench have finite thickness; their unillustrated
ends and bearing depths are inferred. The view is nearly orthographic, fog and
scene ground are disabled, and Restart restores the closed source pose.

- [Bake](validation/174-bake.json): 982 adaptive keys for a six-second cycle;
  maximum error at the recorded samples is below 9.91e-7. The final key is made
  exactly equal to the first after verifying the native seam. Browser playback
  loads no MuJoCo/WASM or live physics.
- [Assembly clearance](validation/174-assembly-clearance.json): all 16 physical
  meshes and 42 cross-body pairs, 129 poses, 2,186,808 surface queries and no
  sampled intersections.
- [Dense jaw contact](validation/174-dense-contact.json): four subinterval
  samples per adaptive key interval, 3,925 poses and 27,427,900 surface queries,
  with no sampled jaw/board intersections. These are sampled checks, not a
  continuous collision proof.
- Two tests pass for measured screw centers, board position, finite transforms,
  fog settings, cycle continuity and exact Restart.
- Production build and [desktop/mobile checks](validation/174-browser.json)
  pass playback, Restart, orbit/reset view, mobile overflow, no WASM requests
  and no page errors. The front view was inspected against the engraving.

## Remaining source-fit work

The [sparse source-feature audit](validation/174-source-fit.json) finds the
upper inner hook and both noses within 1.2 pixels, but the upper crest differs
by 5.15 pixels, lower crest by 10.25 and lower inner hook by 4.58. The lower
outline is still an approximate reflection. Refine those contours independently,
then rerun native/bake qualification, clearance and the final visual comparison.
Do not mark 174 reviewed yet. Continue with 174; the full review remains active.

The [historical baseline](validation/174-existing-contact.json), against commit
f748df7, records seven interfering pairs and 46 poses with prescribed jaw motion
despite positive nominal contact gap. It describes the retained legacy factory,
not the current browser implementation.
