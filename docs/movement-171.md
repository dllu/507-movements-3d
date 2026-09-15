# Movement 171 — oscillating marine valve gear (review open)

Fog and the ground plane are now disabled for the existing model. Finite
slots, guide bores and source proportions still need reconstruction. No new
mechanical model or browser bake is registered.

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
samples the current 18-second selector traversal with 1,501,948 bidirectional
surface queries. It finds the following maximum sampled penetration depths:

| Interface | Depth (world units) |
| --- | ---: |
| Follower / inner slot rail | 0.039720 |
| Follower / outer slot rail | 0.039795 |
| Each guide post / solid guide block | 0.139835 |
| Slide-eye pin / connecting rod | 0.074358 |

The tubular rails leave insufficient room for the finite follower, and the
slider blocks have no actual guide bores. Replace these with explicit slot
walls and openings. This audit covers selected lower interfaces, not the
upper eccentric bearings or the complete assembly.

## Current change and next work

All 101 material instances examined in the existing scene have fog disabled,
and `hideGround` is true. This removes those two rendering problems while the
mechanical reconstruction remains open. It does not fix part intersections.

Next, rebuild the source-visible solids and resolve the lower compensation
construction. Use analytic linkage closure where determined; use MuJoCo if
contacts or otherwise unresolved constraints require it. Any final bake must
have a validated full-cycle seam and a readable crank/reversing speed. Then
check finite surfaces, source fit, restart and desktop/mobile rendering.

```sh
node scripts/review-marine-valve-existing.mjs
node scripts/review-marine-valve-closure.mjs
```

Movement 171 remains open. The full 507-movement review remains active.
