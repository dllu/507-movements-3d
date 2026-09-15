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

The added cylinder, piston, rear crank disk, valve chest/output linkage and
large supporting frame have been removed from the visible model. The source
shows none of these solids. The shaft and trunnion are shorter, with a real
bored trunnion bearing, so these additions no longer obscure the engraving's
valve gear. The rendered scene now contains 36 meshes, including its invisible camera envelope.

The solver uses an inferred hidden crank to determine cylinder oscillation.
The lower sector and its guides are now frame-fixed; only the follower
rockshaft moves with the cylinder. The upper die and central connecting rod
translate the sector vertically. This replaces the earlier model in which
both slot and guides rocked with the cylinder.

The reconstruction follows John Bourne's [A Catechism of the Steam Engine,
section 630](https://www.gutenberg.org/cache/epub/10998/pg10998-images.html).
He describes the sector's ascending guide tail and its end guides on the frame
columns, and specifies curvature centered on the trunnion at valve half stroke.
This contemporary description supports the fixed-guide interpretation of the
abbreviated Brown drawing; it does not provide Brown's unillustrated rocker
pivot dimensions. Those and the diagnostic output linkage remain assumptions.

The [compensation audit](validation/171-compensation.json) independently
recomputes rocker angles and circle distances over 3,605 states spanning five
slide positions and cylinder angles from -0.3 to +0.3 radians. At neutral,
maximum added relative rocker rotation is 5.56e-16 radians. At nonzero slide
positions, it retains the geometric variation rather than imposing exact
cancellation. Over 721 playback poses, the guide columns do not move and the
central connecting rod has zero horizontal span. Arm and slot distance errors
remain below 8.89e-16 world units.

## Existing motion evidence

The [closure audit](validation/171-existing-closure.json) recomputes distances
from exported positions at 721 crank phases for each of five fixed reversing
settings. Maximum length error is 1.34e-14 world units and die-guide error is
7.33e-15. The maximum absolute lower-slot parameter angle is 0.455893 radians.
These checks establish consistency of the implemented ideal construction;
they do not establish source fidelity or finite pin contact.

Full ahead and astern now give valve strokes of 0.204882 and 0.324972 world
units; midgear retains 0.115148. The asymmetric source pin positions change
these excursions; the previously equal strokes resulted from an assumed
symmetric pin layout. These are properties of the current ideal reconstruction,
not historical valve-timing measurements. Fitting the lower slide exposed an
unreachable branch in the old, unillustrated 0.66-length valve connecting link.
That diagnostic link now exceeds the maximum lateral reach of its arm by 0.01,
so it does not constrain source-visible geometry. Its length and the hidden
rockshaft pivot remain assumptions; the resulting valve stroke is not a
validated historical output.

The selector varies continuously over 18 seconds, with three six-second crank
turns in the same interval. The [cycle check](validation/171-cycle.json) checks
all 36 mesh transforms: maximum seam difference is 2.23e-16, and
one-sided velocity difference is 0.000110 using a 0.0001-second step. The former
0.86-radian/second crank did not close with the selector period.

The initial upper rod pins and die coincide with the recorded source anchors.
The lower slide was remeasured using a centerline at raster x=134, an eye at
(134,361), a follower at (134,382), guide endpoints at y=349/507 and separate
left/right block bounds. The former follower anchor at y=394 placed the arc
too low. The neutral slot is now centered on the trunnion without the former
-0.05 preload; its radius is 1.395433 world units.

The [16-landmark source check](validation/171-source-fit.json) compares
actual mesh bounds and pin positions against the engraving. Maximum error is
0.5 pixel at the guide centerlines; both arc apex errors are below 0.012 pixel.
This is an initial orthographic landmark fit with approximate raster line
centers, not a whole-contour or perspective-camera qualification. The central
tail tip, upper guide, reversing lug and rod end now match their recorded
source coordinates. Eccentric outlines and remaining upper proportions still
need whole-contour review.

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

The replacement uses explicit annular slot walls with a 0.102-wide opening
around the 0.09-diameter follower. Actual 0.118-diameter bores surround the
0.11-diameter guide posts. The posts sit behind the slot plate, retaining their
frontal positions; block depth and post offsets are inferred. The rigid
connecting rod has real end eyes, with separate hole sizes for the die and
slide pins. It stays in a single plane between the pins' ends without scaling
or deforming its length.

The [expanded lower-interface sweep](validation/171-lower-clearance.json)
checks 17 pairs at 97 poses over the current 18-second traversal, with
3,050,112 bidirectional surface queries. It finds no sampled penetration above
1e-6 world units. The added pairs cover both rod eyes, guide-post/slot-wall
clearance, the closed slot ends, the attached slide eye and trunnion bearing. This is deliberately a lower-interface qualification, not a
whole-assembly clearance claim. The closure audit is recomputed for the asymmetric upper pin layout.

The lower slide eye is now a bored plate with a web joining the outer arc,
replacing its disconnected torus. Its pin spans both this plate and the
connecting-rod eye. End bridges join both slot walls to each other and the
guide blocks. These are rigid parts of the same slide; their shared solid
junctions are intentional. The shortened trunnion shaft has a 0.33 radius
inside a 0.336-radius bearing opening.

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

The full assembly sweep initially found eight interfering pairs, recorded in
[the pre-repair diagnostic](validation/171-before-upper-joins.json) for commit
bb72218. The reversing rod had a solid joint end and the two added guide bars
intersected the rear eccentric rod and its pin hardware. The replacement
reversing rod has a 0.148-diameter bore around its 0.14-diameter pin, is shortened
to the source extent and omits the added ball handle. Its lug is fitted to the
recorded (60,298) source position.

The central rod now extends upward to the source's y=117 guide-tail tip and
passes through one bored bearing at y=146. A 0.104-by-0.114 opening surrounds
its 0.09-by-0.10 section. Its plane is z=0.52, clear of the eccentric rods;
the lower pin is extended to span the relocated eye. Axial layers and running
clearances are inferred from the front elevation.

The [whole-assembly sweep](validation/171-all-clearance.json) covers all 35
physical meshes, checking 512 pairs across distinct rigid families at 129
poses over the 18-second cycle. Its 17,551,282 bidirectional surface queries
find no sampled penetration above 1e-6. It additionally verifies
axial engagement at the sampled poses for the central tail and both lower
guide posts. Same-rigid-family unions and the non-rendering camera envelope
are excluded. This sampled check does not prove clearance between samples.

## Current change and next work

All 36 material instances examined in the existing scene have fog disabled,
and `hideGround` is true. The default camera now faces the engraving plane.
These rendering flags and the upper/lower interface repairs are shipped while the complete mechanical reconstruction remains open.

The [scoped model test](validation/171-unit.json) passes after replacing stale
symmetry and oblique-camera assumptions with the recorded asymmetric anchors
and current front view. Neutral-only compensation and fixed slot-center checks replace the
earlier artificial all-stroke invariance test. Checks for removed engine/frame
meshes are replaced
with absence checks; closure and source-visible rendered-position assertions
are retained.
The production build and [packaged browser check](validation/171-browser.json)
pass: playback, exact Restart, orbit/reset and a 390-by-844 mobile viewport,
with no page errors or WASM requests. Restart explicitly restores the initial
pose. These checks validate this repair, not the complete reconstruction.

Next, finish the upper source-visible contours. The sampled whole-assembly
clearance check passes for the current geometry and must be rerun after those
changes. The fixed-guide lower compensation is now explicit,
with unillustrated rocker dimensions recorded as assumptions. Use analytic linkage closure where determined; use MuJoCo if
contacts or otherwise unresolved constraints require it. Any final bake must
have a validated full-cycle seam and a readable crank/reversing speed. Then
check finite surfaces, source fit, restart and desktop/mobile rendering.

```sh
node scripts/review-marine-valve-existing.mjs
node scripts/review-marine-valve-all-solids.mjs
node scripts/review-marine-valve-compensation.mjs
node scripts/review-marine-valve-source-fit.mjs
node scripts/review-marine-valve-cycle.mjs
node scripts/review-marine-valve-closure.mjs
node scripts/review-marine-valve-lower-solids.mjs
node scripts/review-marine-valve-upper-solids.mjs
node scripts/review-marine-valve-eccentric-solids.mjs
```

Movement 171 remains open. The full 507-movement review remains active.
