# Movement 171 — oscillating marine valve gear (review open)

Both slotted links now have finite walls and fitted followers. The lower
guide bores and connecting-rod eyes are also repaired in the existing model.
Fog and ground remain disabled. The upper rod pins and die now use their
recorded source coordinates. Whole-contour proportions and the complete
reconstruction remain open; no bake is registered.

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
settings. Maximum length error is 1.34e-14 world units and die-guide error is
6.67e-15. The maximum absolute lower-slot parameter angle is 0.447508 radians.
These checks establish consistency of the implemented ideal construction;
they do not establish source fidelity or finite pin contact.

Full ahead and astern now give valve strokes of 0.142383 and 0.236153 world
units; midgear retains 0.087461. The asymmetric source pin positions change
these excursions; the previously equal strokes resulted from an assumed
symmetric pin layout. These are properties of the current ideal reconstruction,
not historical valve-timing measurements.

The selector varies continuously over 18 seconds, with three six-second crank
turns in the same interval. The [cycle check](validation/171-cycle.json) checks
all 84 visible mesh transforms: maximum seam difference is 4.45e-16, and
one-sided velocity difference is 0.000110 using a 0.0001-second step. The former
0.86-radian/second crank did not close with the selector period.

The initial upper rod pins and die coincide with the recorded source anchors,
replacing the previous 10.52- and 11.87-pixel rod-pin errors. This is an anchor
fit using the shaft/trunnion scale, not a whole-contour qualification. The slide
eye remains within 3.61 pixels and lower follower within 4.41 of their recorded
anchors. The eccentric straps and rods now have integral tapered outlines and real
bearing bores; their whole-contour source fit still needs review.

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
2,146,668 bidirectional surface queries. It finds no sampled penetration above
1e-6 world units. The added pairs cover both rod eyes and guide-post/slot-wall
clearance. This is deliberately a lower-interface qualification, not a
whole-assembly clearance claim. The closure audit is recomputed for the asymmetric upper pin layout.

The upper link is now one plate with a through-slot and bored rod/reversing
lugs, replacing the tubular rails and separate end bridges. Its 0.12-wide
opening contains a 0.11-wide curved die that rotates with the local slot
tangent. The die and output-rod eye have 0.098-diameter bores around a
0.09-diameter pin. Plate thickness and these running clearances are inferred;
the recorded rod-pin coordinates are retained. The reversing-lug pin extends
through the plate instead of ending ahead of it.

The [upper-interface sweep](validation/171-upper-clearance.json) samples six
pairs over 97 poses, covering die/slot, die/pin and all three lug pins against
the plate. It finds no sampled penetration above 1e-6 and checks that every
pin overlaps the plate axially by more than 0.15 world units. This does not
qualify the eccentric straps or the rest of the assembly.

Each eccentric strap and rod is now one rigid plate: a broad ring joins a
neck that tapers down to a bored pin eye. The 1.392-diameter strap opening fits
the 1.38-diameter sheave, leaving 0.006 radial clearance. Rod-end bores are
0.148 in diameter around 0.14-diameter pins. The straps rotate with their
finite rods rather than remaining upright while a separate bar passes through
the sheave. The unillustrated oil cups were removed. Flat annular sheave rims
and axially offset pin caps avoid interference with the new rod faces.
These thicknesses and running clearances are reconstruction assumptions.

The [eccentric-interface sweep](validation/171-eccentric-clearance.json) checks
21 pairs at 97 poses, including both rods against sheaves, rims, pin hardware,
the upper plate and output rod, plus each other. Its 2,723,760 surface queries
find no sampled penetration above 1e-6. This remains a selected-interface
qualification, not a whole-assembly or whole-contour fidelity claim.

## Current change and next work

All 84 material instances examined in the existing scene have fog disabled,
and `hideGround` is true. The default camera now faces the engraving plane.
These rendering flags and the upper/lower interface repairs are shipped while the complete mechanical reconstruction remains open.

The [scoped model test](validation/171-unit.json) passes after replacing stale
symmetry and oblique-camera assumptions with the recorded asymmetric anchors
and current front view. Closure and rendered-position assertions are retained.
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
node scripts/review-marine-valve-cycle.mjs
node scripts/review-marine-valve-closure.mjs
node scripts/review-marine-valve-lower-solids.mjs
node scripts/review-marine-valve-upper-solids.mjs
node scripts/review-marine-valve-eccentric-solids.mjs
```

Movement 171 remains open. The full 507-movement review remains active.
