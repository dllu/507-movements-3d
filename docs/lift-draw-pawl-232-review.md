# Movement 232: retaining click and working joints

This is a partial mechanical correction. The retaining click and selected joints now have finite, checked working geometry. The main drawing pawl still intersects the wheel; its prescribed output law is not a solved transmission.

The [official caption and engraving](https://507movements.com/mm_232.html) show B lifting C out of the teeth, carrying it backward, then lowering it to draw the wheel. The page fetched on 2026-09-16 contains no canvas, inline animation program or `ae.add_model` registration. Animation availability remains false based on those checks, rather than only the tab's initial CSS class.

The wheel's square tooth section, pawl working face, ground pivots and equal-link parallelogram are retained. Outward cosmetic bevels no longer expand working profiles or narrow the pin holes. The coupler has actual bored eyes; the input handle and C have bores for their coupler pins. A small fixed boss around the click pivot provides a complete frame bearing. The frame, handle and coupler axial layers now clear one another. The retaining body sits ahead of the wheel, with a separate bored working roller extending into the tooth plane and supported by its axle. The roller seats at the actual outer tooth corner; its position and rounding are inferred, while the engraved fixed pivot is retained.

The old click's buried nose and short sinusoidal lift crossed the square teeth. The corrected click follows a continuous prescribed lift before the draw, stays clear while the tooth passes and reseats at the end. This is not a passive spring/contact simulation. Holding during its early release is unresolved, alongside the main drawing-pawl contact. Both limitations appear in the viewer's `reconstructionNote`. Playback has a minimum six-second cycle, no ground or fog, and retains geometry buffers.

## Evidence and remaining work

```sh
node --test tests/movement-232.test.mjs tests/lift-draw-pawl-232-solids.test.mjs
```

All **13 tests pass**: eight source/kinematic regressions and five focused finite/contact checks. The new suite samples 193 poses over two cycles for click/wheel clearance, checks actual roller/tooth witnesses and compressive torque opposing rollback, and verifies that a small attempted rollback penetrates the real retaining face. It also checks ten selected pin/plate pairs across 33 poses, prescribed click derivatives, public contact fields and retained buffers. These are selected interfaces, not exhaustive all-pairs qualification.

The corrected retaining surfaces clear the wheel; the smallest sampled signed clearance is approximately `0.0000211` model units. The main C/wheel residual remains `−0.1300`, with a source-pose witness near wheel-local `[0.337031, 1.834688, 0.060000]`. Its previous bevel-expanded witness was approximately `−0.1742`. The residual test caps its magnitude and requires disclosure, allowing future improvements to pass.

An offline diagnostic subtraction of the stationary/advancing wheel envelope from the current long generated C face disconnected the shape and removed large portions of the claimed driving surface. That clearance-only alteration was rejected. This does **not** establish that the engraved rigid C mechanism is impossible: the source has an outer body and short inward tip, while the current long generated working curve is incompatible with its return path. The next correction should use a finite rounded short tip against the actual radial tooth flank, solve output angle from that contact, and include explicit lift, dwell and drop intervals. Its passive loading and the retaining click's early-release hold then need separate qualification.

Root's final source/default/oblique views report no errors or viewport clipping
(maximum normalized extent 0.82992). A flush white index inside the wheel's root
disk replaces its former floating extension into a tooth gap. The integrated
build and packaged desktop/playback/mobile check pass. No native dynamics
qualification is claimed.
