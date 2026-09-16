# Cycloidal pendulum and recording level: 369, 411

Primary references: [369](https://507movements.com/mm_369.html) and
[411](https://507movements.com/mm_411.html), checked 2026-09-15 alongside
local engravings. Neither page provides a canvas animation. Their existing
analytical motion laws are retained; no contact solver runs in the browser.

## Corrections

369's visible cord previously overlapped the cheek rails. Both actual cheek
faces now offset the ideal cycloidal cord centerline by the 0.028 cord radius,
plus 0.0006 allowance for the segmented rendering. The contact rails share
that offset and the cord's depth plane. The rear suspension boss clears the
cord, with a short connecting anchor stud. The white tangency dot is explicitly
an annotation drawn in front of the cheek. The exact Huygens centerline,
constant analytical cord length and amplitude-independent period are unchanged.
A six-second minimum display cycle makes the wrapping easier to follow.

411's tire now has the specified rolling radius at its outside, rather than
sinking into the ground by the torus thickness. A pointed pencil replaces a
sphere that penetrated the paper. Chart markings are thin drawn lines instead
of raised physical ribs; the trace lies 0.0008 above the substrate. Actual bores
in the wheel hubs, pendulum eye, drum, collars, bearing and adjustment guide
clear the corresponding shafts. The base brace is behind the drum. Real 18/18
conical involute gears replace two smooth cones, sharing a common apex and
preserving the existing opposite one-to-one shaft rotations. Their axes extend
forward from the wheel and along the drum, with a bearing and support bridges.

Both models reuse the finite journal/plate and full-cycle fitting helpers,
disable generic ground/fog, and return their source-facing default camera.
411 retains the moving terrain strip needed to explain wheel travel.

## Validation and limits

`node --test tests/movement-369.test.mjs tests/movement-411.test.mjs tests/pendulum-instrument-solids.test.mjs`

21 tests pass. The two new checks sample 65 poses against actual triangle
surfaces: 369 cord/cheeks/rails/suspension boss; 411 gear members, tire/ground,
shaft/journals, pencil/paper, pendulum/paper and brace/drum. Sampled bevel
proximity remains below 0.003. The 369 rail lies within 0.001 of the finite cord
at tangency. These are bounded regression checks, not exhaustive collision
proofs. Existing analytical tests cover the ideal timing, rolling and trace laws.

Chrome default/oblique comparison and 17-pose framing checks report no errors
or clipping (maximum absolute projected coordinates 0.906 and 0.898).
Bulk captures remain outside Git. The final paper-line rendering is additionally
covered by packaged browser playback/mobile checks.

369 still models a massless flexible cord and point-mass bob; the visible bob
and anchoring have no inertia or bending model. 411 remains quasi-static, with
prescribed terrain inclination, no pendulum transient and no wheel traction or
pencil drag model. Its compact axle-level drum and shorter construction triangle
remain schematic differences from the engraving's elevated drum/taller frame.
The bevels use the shared Tredgold back-cone approximation, not exact octoid
flanks. Working journal dimensions and the gear counts are engineered.
