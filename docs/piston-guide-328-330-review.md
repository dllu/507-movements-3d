# Piston guides 328 and 330

Primary sources: [328](https://507movements.com/mm_328.html) and
[330](https://507movements.com/mm_330.html), including the engravings and captions.
328 registers a working inline `ae.add_model` animation; 330 has neither that
registration nor `mm_present`. The existing exact paired slider-crank and offset
slider-crank equations remain unchanged. Neither requires live contact physics
for this prescribed one-degree-of-freedom demonstration.

## 328: Cartwright motion

The equal wheels now have four open spokes and true shaft bores rather than
solid disks. Bearing sleeves/housings have actual bores, and their supporting
posts terminate below the shafts. The meshing gears sit in front of the fixed
bearings and beam; the cranks sit in front of the gears and behind the rods.
Their shafts span the assembly but stop short of the moving connecting rods.
Both connecting rods have real crank and wrist eyes, including their face rings.

A central boss now joins the previously detached piston rod to the crosshead.
The cylinder, cap and gland share the rod's axial plane and have real passages.
The body reaches its cap, and a hollow neck joins the cap to the gland. Those
parts were previously offset in depth and disconnected vertically. The source
animation defines the rod and upper mechanism; the complete cylinder continuation
and mounting thicknesses remain inferred.

A finite gear audit exposed 24 tiny penetrations (maximum 0.00001022 model units)
in the polygonal working flanks at 33 sampled assembly poses. A 0.0001-unit
angular tooth-thickness allowance removes that overlap without altering root,
tip or pitch radii, tooth counts, or transmission ratios. The final test checks
129 assembly poses and both meshing pairs, with no sampled penetrations over
1e-6 units; calculated ideal contact ratios remain above 1.1. These are finite
samples, not a continuous collision proof. The allowance retains involute flanks
with a small intentional running clearance.

## 330: forked connecting rod

The fork's crank and wrist eyes now have actual bores. The stem and prong bars
stop outside those holes. Shortened the solid stem at the branching transition
so the top of the prolonged piston rod clears it. The crosshead now fits between
the lower prongs rather than filling their rotating working planes.

Guide A has a bored bearing block. Its bracket lies in the gap between the fork
prongs and connects to the rear frame through a depth bracket beyond the moving
parts. The crank is in front of its stationary bearing, which now has a real
shaft passage. The cylinder and gland now share the piston-rod axis in depth.
A hollow cylinder clears the finite piston head; the rod's lower extension joins
the head and keeps it below the cap and above the base throughout the stroke.
Previously the offset head intersected the solid cylinder and emerged above its
cap near the upper dead center.

## Evidence and remaining scope

`node --test tests/movement-328.test.mjs tests/movement-330.test.mjs tests/piston-guide-solids.test.mjs`
passes 21 tests. The new tests check finite rendered pin/rod cross-sections,
gear engagement and sampled working teeth, connected rod/gland attachments,
fork clearance against the piston/crosshead/fixed guide, piston containment,
and complete camera bounds. Existing tests retain motion derivatives, closure,
source landmarks, equal obliquity and prolonged-rod guidance.

Both models disable ground/fog and fit their whole stroke. Default and advanced
oblique source comparisons show no browser errors; 17 projected poses stay in
frame, with maximum absolute coordinates 0.883 and 0.829. 328 has a nearly frontal
initial view, while 330 retains enough obliquity to show both depth-separated
fork prongs. Final geometry reads under 48,000 rendered triangles per scene,
including shadows. No geometry is regenerated during playback.

The complete wheels/cylinders extend beyond the cropped engravings. 328 still
starts in the official animation's outward-crank phase rather than the engraving's
inward phase; its lower support continuation and several frame proportions are
inferred. 330's simplified frame and rectangular fork transition are not exact
source outlines. The tests qualify the corrected interfaces, not every possible
solid pair or steam-pressure dynamics. These remain bounded family corrections,
not full source or physics qualification.
