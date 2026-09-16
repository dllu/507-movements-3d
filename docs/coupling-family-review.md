# First correction pass: parallel-shaft crank couplings

Movements [220](https://507movements.com/mm_220.html) and
[230](https://507movements.com/mm_230.html) were reviewed together against their
engravings and captions on 2026-09-15. Both official pages mark their Animated
tab unavailable, so no original 2D motion oracle exists for this pair.

These mechanisms remain analytical. For 220 the wrist travels on a circle and
the output angle is the bearing from the second shaft to that wrist. For 230,
equal cranks and equal rods form two parallelograms, offset by a quarter turn;
their output angles equal the input angle. Contact simulation would add no
necessary information to those ideal geometric constraints.

## Changes

| Movement | Defect | Correction |
| --- | --- | --- |
| 220 | The output hub overlapped the roller near minimum slot radius. The slot's rounded inner end also extended through the hub. | Reduced the hub and shortened the unused inner slot extension. The rendered roller clears the hub by 0.0784 model units at its closest approach. Shaft offset and crank throw stay unchanged. |
| 220 | Framing bounds did not cover the bottom half of the rotating long slotted arm. | Bounds cover the complete circular sweep; a view from the other side exposes the wrist and both shaft ends. |
| 230 | Shafts extended through both moving rod planes; the rod equations alone did not detect the resulting dead-center collision. | Explicit shaft endpoints stop inside both rod planes. Shared `makeCouplingShaft` builds these from the existing shaft primitive. |
| 230 | Floating bearing rings were absent from the source; an oversized invisible box made framing unnecessarily loose. | Removed the rings and invisible mesh; use compact full-cycle bounds and a view exposing both rod planes. |
| Both | Default scene fog and ground remained enabled. | Disabled fog and ground for these isolated assemblies. |

`src/simulation/coupling-shaft.js` accepts physical shaft endpoints, making
axial layering explicit for other crank and linkage families. Reuse this or the
underlying `makeShaft` rather than adding an arbitrarily long decorative shaft.

## Validation and remaining assumptions

`node --test tests/movement-220.test.mjs tests/movement-230.test.mjs tests/coupling-clearance.test.mjs`
passes 17 tests. Existing tests cover full-turn analytical position, velocity,
acceleration and joint closure. New checks measure actual rendered roller/hub
separation, cast a ray through the nearest wrist position to verify an open
slot, verify shaft/rod axial separation at both pairs of dead centers, and
contain all visible geometry in its framing bounds across 65 poses. Desktop
browser checks across 17 poses report no errors or clipping: maximum absolute
projected screen coordinate is 0.656 for 220 and 0.842 for 230 (the viewport
edge is 1). The initial camera now exposes both rods of 230; 220 retains space
for the complete sweep of its long slotted arm.

This is a bounded correction pass, not exhaustive physical qualification.
The original drawings do not specify precise depth, running clearance or
material dimensions. Those are reconstruction choices. The 220 roller has
visible running clearance in the slot; the analytical solution places it on
the centerline and does not model lateral backlash or impact. The 230 rods use
ideal revolute pin constraints and do not model bearing clearance or elastic
load sharing between its two parallel linkage loops. Finite thicknesses are
checked at the corrected interfaces, but an all-pairs collision audit has not
been performed. Broad source proportions are retained without pixel fitting.
