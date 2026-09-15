# Movement 156 — engraving-based slotted elbow

156 now uses a lightweight analytic assembly with engraving-based proportions,
a finite slot, bored pin joints, retained shafts and a guided output. The
previous trajectory was correct for the official animation's different dimensions.

## Oracle verification

The [source page](https://507movements.com/mm_156.html) includes an executable
2D animation of the crank-pin, slotted elbow and pinned output rod. The comparison
script executes that definition with the actual `anilib.js` library in an
isolated JavaScript VM and a no-op canvas. It reads the library's transformed
important points, rather than reimplementing its kinematics as the reference.
Source scripts are downloaded or read from temporary files; they are not copied
into the repository.

Across 721 equal crank phases, maximum position differences for the previous
model are below 4.8e-15 world units. The new reusable analytic constraint solver,
when configured with the oracle's dimensions, agrees below 5.5e-15. This checks
trajectory agreement, not rendered geometry, forces or wall-clock animation
speed. The four-second period is retained as a readable reconstruction choice.

## Engraving discrepancy

Aligning the animation's disk center and radius with the original engraving
still gives the following initial landmark errors:

| Landmark | Error |
| --- | ---: |
| Crank-pin center | 9.64px |
| Fixed bell pivot | 21.73px |
| Output joint | 20.93px |

These are differences between the drawing and the animation's geometry, not
errors in the previous analytic equations. They justify changing the visible
proportions rather than replacing a determined linkage with live dynamics.
Measurements are approximate center readings, with roughly 2px uncertainty.

The production source parameters use disk center (214,209), radius 118, crank pin
(140,157), fixed pivot (280,388), and output joint (438,289), all in the original
525px image. The near/far slot-cap center readings are projected onto the ideal
straight slot axis, since the hand-drawn centerline is not exact.

The lower rod is cropped in the source. Its reconstructed complete length of
270px and vertical guide x=438 are explicit reconstruction choices, not measured
hidden geometry. This is shorter than the 2D animation's inferred full rod and
changes the output displacement curve slightly. The oracle agreement above
applies to the solver configured with oracle dimensions, not these new dimensions.

## Analytic constraint model

`slotted-elbow-motion.js` computes the rotating pin, slot direction through the
fixed pivot, rigid elbow output point, and intersection of the fixed-length rod
with the vertical guide. It does not prescribe follower easing curves or
simulate force/friction. Invalid rod reach or a pin at the fixed pivot throws
instead of silently clamping a square root.

Three tests check the measured initial landmarks and 4,097 full-turn poses:
constant crank radius, pin on the slot centerline, finite slot-end clearance,
constant rod length, vertical guidance and periodic closure. With the oracle
parameters, the same solver also reproduces the actual source library.

## Visible assembly and validation

The crank pin has the same nominal radius as the slot half-width; its center
follows the straight slot exactly. The elbow and output rod use ordinary bored
pin joints and axial retainers. The rod is free to swing as the crosshead moves
vertically. Hidden rear supports and the complete lower guide are reconstructed.
The assembly uses 31 static meshes; playback updates four rigid transforms.

The visible-solid audit checks 312 part pairs over 129 full-cycle poses, including
same-moving-body interfaces once and excluding intentional fixed-frame unions.
It found no unintended intersections in 6,214,504 bidirectional surface queries.
This finite sampling is not a continuous collision proof. Geometry tests also
check rendered joint closure, unchanged mesh geometry, full-sweep bounds, disabled
fog, hidden ground and exact restart. No forces or friction are simulated.

The production build and packaged Chrome desktop/mobile test pass: play/pause,
restart, orbit, reset view, 390px layout, no page errors and no WASM requests.
Source, oblique and mobile views were inspected. The full rod and support frame
remain visible; a four-second input revolution keeps the motion readable.

```sh
node scripts/compare-slotted-elbow-oracle.mjs
node --test tests/slotted-elbow-motion.test.mjs
node scripts/review-slotted-elbow-assembly.mjs
```

Optional `SOURCE_HTML` and `SOURCE_LIBRARY` environment variables point to local
copies for repeatable offline comparison. Reference hashes, sample coordinates,
source-alignment errors and code hashes are recorded in
`docs/validation/156-oracle-comparison.json`.
