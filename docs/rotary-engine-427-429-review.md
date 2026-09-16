# Rotary engines 427–429: finite working geometry review

Primary references: [427](https://507movements.com/mm_427.html), [428](https://507movements.com/mm_428.html), [429](https://507movements.com/mm_429.html), their local engravings and the original Canvas constructions where present. Both `ae.add_model` and `mm_present` occur in 427 and 429; neither occurs in 428. The unavailable-animation CSS class alone was not used as evidence. The official 427 animation intentionally makes the two vanes symmetric, identifying their engraving asymmetry as an error; the reconstruction retains that interpretation.

## Corrections

- **427:** Rolling packings previously were solid disks crossed by blades. They now have real blade slots and rear webs, rotate in actual hub bores, and retain finite supporting material. The front hub is relieved for the analytically bounded blade sweep (maximum relative inclination `asin(0.5 / 2)`), while its rear web remains connected. Rounded piston noses follow the existing source nose radius instead of square sealing blocks entering the casing. Added head-guide pins run between the fixed guide rings; the rings occupy a distinct head plane. The casing is a closed annular solid, rather than a thin wall plus an inward-projecting decorative torus.
- **428:** Rollers have real axle bores and carrier arms sit behind their working faces. The liner's triangle winding is corrected and its angular resolution increases from 180 to 720 nodes, retaining the same twelve visible material witnesses. Its finite inner edges stay outside the circular rollers throughout the sampled cycle, with under 0.00012 units of contact separation from liner tessellation (the 256-sided rollers add at most 0.000038 units). The rigid casing is a closed annular solid with nonintrusive front lips.
- **429:** Removed the 0.025-unit expanding bevel from the original official mating profiles and bored both shafts. The working housing follows the union of the two source circles, with open central inlet/outlet throats and a corresponding outlet opening in the foundation. Previously the intrusive inner tube and capsule-shaped cavity disagreed with the intended working envelope. Packing indicators are visible on the front faces rather than buried inside the pistons.

All three hide the ground plane, disable material fog, and retain readable whole-cycle framing. Axial construction, small running clearances and supports are inferred because the engraving is a section rather than a manufacturing drawing.

## Validation and remaining assumptions

Run:

```sh
node --test tests/movement-427.test.mjs tests/movement-428.test.mjs tests/movement-429.test.mjs tests/rotary-engine-427-429-solids.test.mjs
```

Thirty legacy tests and four new tests pass. New checks sample actual triangle solids in both directions over 65 poses, including blade/packing/hub/guide-ring joints for 427, roller/arm/axle/casing joints for 428, and piston/packing/casing pairs for 429. The liner check additionally measures every finite inner edge against each roller circle. These are bounded sampled checks, not continuous collision proofs.

**429 is not yet an interference-free conjugate rotor pair.** Preserving the original official polygonal outlines leaves a maximum sampled penetration of **0.0134534 units** between the two mating pistons (shaft spacing 2.88). The regression records a 0.0135 upper bound separately from the strict casing/joint clearance checks. Resolving the residual requires reconstructing conjugate working curves; arbitrary profile shrinking was deliberately avoided. The original motion and tooth arrangement remain intact.

**428 is a prescribed deformation illustration.** The symmetric radial roller contact does not establish a steam-driving torque. Elastic deformation, pressure asymmetry, attachment, friction, sealing and fluid timing remain unvalidated. The animation does not claim those are solved by physics. Likewise, 427 and 429 retain their analytically prescribed rotation/slide constraints; steam pressure, packing compression, leakage, inertia and load response are not simulated. No MuJoCo model was introduced for these determinate geometric repairs.

Browser review compared default, front and rear quarter-cycle views to each engraving. A 65-pose projection sweep found zero visible vertices outside the default viewport for all three. Bulk screenshots and logs remain outside Git in `/dev/shm/rotary-engine-427-*`, `/dev/shm/rotary-engine-428-*`, `/dev/shm/rotary-engine-429-*` and `/dev/shm/rotary-engine-browser-review.json`.
