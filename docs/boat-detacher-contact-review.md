# 492: captured tongue and tackle-hook release

This follow-up resolves the tongue/tackle interpenetration recorded in the [spatial linkage pass](spatial-linkage-family-review.md). It qualifies locked capture and a continuous, prescribed release path. It does not claim a passive force solution.

## Source and correction

[Brown's caption and engraving](https://507movements.com/mm_492.html) show an upright boat-fixed standard, an upper hinged tongue retained by a lever eye, and a tackle hook carrying that tongue. Pulling the lever removes the eye; the tongue can then leave the tackle. There is no official 2D animation for 492.

The previous tongue rotated down/counterclockwise through the tackle's bight. An upward tackle force applied to the left of the tongue hinge instead produces a clockwise moment. The corrected demonstration rotates the tongue clockwise after unlocking. Its full clear pose is an inferred 110-degree rotation, not a dimension supplied by Brown.

The tackle now has a closed, finite J-shaped plate with a lower seat that meets the actual underside of the locked tongue. The old rounded tube crossed the tongue body even at rest. Ideal curves define the new forged outline; this is a mechanical reconstruction, not decorative contour tracing. Its upper shank attaches below the tackle eye without filling that opening.

The tongue end is wider at its retained station and tapers toward its tip. This limits rotational play while allowing the closed transverse eye to slide off without binding as the lever turns. Existing bored hinge interfaces and the offset neck are retained. Two legacy contact-marker spheres are hidden because their old positions did not mark the reconstructed bearing contact.

The ten-second demonstration is protected with `minimumDisplayCycleSeconds`, so display-profile timing does not compress the staged release into two seconds. The return remains a deliberate reassembly demonstration.

## Evidence

`node --test tests/boat-detacher-contact.test.mjs tests/spatial-linkage-solids.test.mjs tests/movement-492.test.mjs`

**13/13 tests pass.** Three new contact tests add:

- Bidirectional triangle-surface clearance through 257 complete-cycle poses, including the tongue, tapered end, offset neck, tackle body/eye, latch eye and upright standard.
- A locked seat with essentially zero geometric gap. Attempting to raise the tackle by 0.015 model units produces more than 0.005 units of penetration, proving the hook cannot simply pass upward through the retained tongue.
- A locked eye that blocks a 0.10-radian clockwise tongue perturbation. The seat's upward reaction acts left of the hinge and therefore has the corrected clockwise moment.
- A released tongue that permits another 1.5 units of vertical tackle withdrawal without crossing the hook in either surface direction.

The existing source, linkage, order and continuity tests pass. The shared finite tests for 261/489 also remain unchanged and passing. Final browser source/default/front/advanced views show no errors or clipping; maximum projected extent across 17 poses is 0.843. RAM artifacts are `/dev/shm/detacher18-492-{default,front,advanced}.png` and `/dev/shm/492-pass18-tests-final.txt`.

## Remaining assumptions

The animation commands tongue rotation and then raises the tackle. It does not integrate contact force, gravity, load redistribution between the boat ends, preload, friction, elastic seating or release speed. Finite geometry establishes retention and a clear continuous path, not structural strength or passive release timing. A load-driven MuJoCo study can now use nonintersecting visible geometry; it should not infer a validated force solution from the prescribed sequence. The enlarged tapered end, axial offset, J-seat profile and exact angles are reconstruction choices, since Brown supplies only one projected locked view.
