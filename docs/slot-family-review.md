# Circular and crossed-slot family pass: 203, 210, 252

Reviewed against the engraving and captions at [203](https://507movements.com/mm_203.html), [210](https://507movements.com/mm_210.html), and [252](https://507movements.com/mm_252.html). Their existing analytic constructions retain the official animation's geometry and endpoint ordering. This pass changes the finite solids and presentation, not the transmission equations.

## Corrections

- **203:** Replaced slightly inconsistent drawn slot walls with concentric circular offsets and rounded ends, leaving 0.008 model units of nominal radial pin clearance. Removed the inward bevel, moved outline tubes onto the solid side, and bored the output link and its follower boss. Removed the invented stand and ground. Camera fitting covers the entire stroke with a view close to the source elevation.
- **210:** Corrected inward-facing rounded slot endcaps, which excluded the roller center at the reversals, and the backwards outer tip cap that split the plate when its slot was subtracted. Boolean subtraction now produces the actual hole instead of allowing triangulation to bridge it. The slot has 0.003 model units of nominal radial clearance, no inward bevel or intrusive outline tube, and the roller has an axle bore. Reduced guide depth so its front edges remain behind the rocking plate. Removed the invented stand while retaining the engraved guide blocks. Camera fitting covers the full stroke.
- **252:** Continued both oblique slot cuts through the crossbar and lower stiffening web. Those separate solid boxes previously blocked the finite pins near the bottom ends, despite correct pin center constraints. Retained the symmetric endpoint data and traverse/dwell schedule. Removed ground/fog and fitted both full-stroke endpoints, including the input stem.

Existing shared finite-plate boolean geometry and bored planar-link geometry supply the corrections. Ideal lines, circles and capsules are appropriate here; recovering each uneven engraved edge would worsen the intended mechanical geometry.

## Validation and remaining limits

`node --test tests/movement-203.test.mjs tests/movement-210.test.mjs tests/movement-252.test.mjs tests/slot-family-clearance.test.mjs`

The new tests raycast the rendered triangles over complete finite pin/roller discs at 65 or more poses, including 210's exact reversals. They check 203's plate and output eye, 210's slot and roller axle bore, and 252's arms, crossbar, web and fixed rails. The existing tests retain dense analytic constraint, derivative and cycle checks. These targeted checks are not a general all-mesh collision proof.

The browser front views still show a source-fit discrepancy in 203: the official-animation construction has a broader lower lobe and a longer slot return below the input pivot than the engraving. That reconstruction remains open for a later source-fit pass; this is a finite-clearance correction, not a claim of complete engraving alignment. 252 also keeps larger unindexed roller flanges from the previous reconstruction.

203 retains the official animation's abrupt changes between constant-speed strokes and dwells. 210 retains a smooth prescribed rocker and the existing illustrative loaded-wall rolling law; the engraving does not determine load, friction or which wall carries the roller. The small rendered clearance means that law is not a solved physical contact trajectory. 252's unindexed collars intentionally do not claim a particular spin law. Shafts and pins fixed within the same rigid member may have overlapping solid volume; relative moving axle interfaces addressed here have actual clearance holes.

Browser review at 1400×850 captured default and front views and sampled projected mesh bounds through 17 cycle poses. No page errors; maximum absolute screen coordinates were 0.795 (203), 0.856 (210), and 0.875 (252), inside the viewport. These are desktop checks; mobile and arbitrary camera orbits are not certified by this capture.
