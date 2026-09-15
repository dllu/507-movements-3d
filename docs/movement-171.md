# Movement 171 — oscillating marine valve gear (review open)

The lower slot walls, guide bores and connecting-rod eyes are repaired in the
existing model. Fog and ground remain disabled. Upper geometry, source
proportions and the complete reconstruction remain open; no bake is registered.

## Source

The [source page](https://507movements.com/mm_171.html) has no working animation
script. The 263-by-525 engraving shows two eccentric straps and rods, a short
slotted reversing link, a central connecting rod and a curved slide above the
trunnion. The caption identifies the lower slot as an arc described from the
trunnion center, accommodating the cylinder's oscillation without interfering
with valve stroke.

The existing reconstruction adds a complete cylinder, piston, rear crank,
rockshaft output linkage and large supporting frame. Those hidden components
are assumptions, not measurements from this drawing. The replacement should
retain the illustrated mechanism and explicitly justify the hidden closure
needed to move it. In particular, verify which lower guides and members move
with the cylinder when reconstructing the trunnion-centered compensation.

## Existing motion evidence

The [closure audit](validation/171-existing-closure.json) recomputes distances
from exported positions at 721 crank phases for each of five fixed reversing
settings. Maximum length error is 1.29e-14 world units and die-guide error is
8.11e-15. The maximum absolute lower-slot parameter angle is 0.368659 radians.
These checks establish consistency of the implemented ideal construction;
they do not establish source fidelity or finite pin contact.

Full ahead and astern each give a valve stroke of 0.189608 world units. Midgear
retains 0.060124 stroke, so it is reduced travel rather than an exact stop.
The current selector varies continuously over 18 seconds while the crank runs
at 0.86 radians/second. Eighteen seconds therefore does not close the complete
mechanism: crank phase differs by 2.913629 radians and local valve position by
about -0.059969 world units. Do not treat the selector period as a seamless
animation loop when designing playback.

The initial projected upper link pins miss the recorded engraving centers by
10.52 and 11.87 pixels. The die is within 0.25 pixel, the slide eye within 3.61,
and lower follower within 4.41. This approximate projection uses the existing
shaft/trunnion anchors, not a fitted whole-contour comparison. The eccentric
straps and tapered rods also need visible-shape review.

## Finite interfaces

The [97-pose selected-interface audit](validation/171-existing-contact.json)
samples the pre-repair 18-second selector traversal with 1,501,948 bidirectional
surface queries. It finds the following maximum sampled penetration depths:

| Interface | Depth (world units) |
| --- | ---: |
| Follower / inner slot rail | 0.039720 |
| Follower / outer slot rail | 0.039795 |
| Each guide post / solid guide block | 0.139835 |
| Slide-eye pin / connecting rod | 0.074358 |

This historical audit describes commit c821b18, before the lower repairs.
The tubular rails left insufficient room for the finite follower, and the
slider blocks had no actual guide bores. It covers selected lower interfaces,
not the upper eccentric bearings or complete assembly.

The replacement uses explicit annular slot walls with a 0.202-wide opening
around the 0.19-diameter follower. Actual 0.118-diameter bores surround the
0.11-diameter guide posts. The posts sit behind the slot plate, retaining their
frontal positions; block depth and post offsets are inferred. The rigid
connecting rod has real end eyes, with separate hole sizes for the die and
slide pins. It stays in a single plane between the pins' ends without scaling
or deforming its length.

The [expanded lower-interface sweep](validation/171-lower-clearance.json)
checks ten pairs at 97 poses over the current 18-second traversal, with
2,151,628 bidirectional surface queries. It finds no sampled penetration above
1e-6 world units. The added pairs cover both rod eyes and guide-post/slot-wall
clearance. This is deliberately a lower-interface qualification, not a
whole-assembly clearance claim. The ideal closure audit is unchanged apart
from its source hash.

## Current change and next work

All 99 material instances examined in the existing scene have fog disabled,
and `hideGround` is true. These rendering flags and the lower-interface repairs
are shipped while the complete mechanical reconstruction remains open.

The production build and [packaged browser check](validation/171-browser.json)
pass: playback, exact Restart, orbit/reset and a 390-by-844 mobile viewport,
with no page errors or WASM requests. Restart explicitly restores the initial
pose. These checks validate this repair, not the complete reconstruction.

Next, rebuild the source-visible solids and resolve the lower compensation
construction. Use analytic linkage closure where determined; use MuJoCo if
contacts or otherwise unresolved constraints require it. Any final bake must
have a validated full-cycle seam and a readable crank/reversing speed. Then
check finite surfaces, source fit, restart and desktop/mobile rendering.

```sh
node scripts/review-marine-valve-existing.mjs
node scripts/review-marine-valve-closure.mjs
node scripts/review-marine-valve-lower-solids.mjs
```

Movement 171 remains open. The full 507-movement review remains active.
