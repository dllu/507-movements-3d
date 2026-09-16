# Movement 455: finite closing contact and continuous release

This supersedes the 455 interference residual in [the earlier rotary-pump review](rotary-pump-455-456-review.md). The [official caption and engraving](https://507movements.com/mm_455.html) require a fixed lower-side projection to close two rotating hinged vanes. The page has no inline `ae.add_model` / `mm_present` animation definition. Brown does not specify the contact contour, hinge limits or return load.

## Correction

The former 80-degree fold schedule and hinge-angle-derived wedge interfered by up to 0.23727 model units. A finite vane can remain in closing contact past the bottom position; it needs more than 90 degrees of folding before release. The former unrelieved rotor also blocked that branch.

The corrected abutment is a **reconstructed rounded projection**, a radius-0.65 circle centered at `(0.99, -1.71473)`, clipped at the 2.35-radius housing. It is a deliberate functional simplification of the engraved wedge, not a traced or dimensioned original. Its solid wall remains attached to the housing. The vane blade and sealing lip have their actual finite outlines in the contact calculation.

`scripts/generate-old-pump-contact.mjs` computes the continuous closing branch offline by maintaining a small clearance between those polygons and the fixed circular face. It does not remove the complete sweep from the abutment. The resulting 2,731 closing samples, at 0.05-degree input intervals, are stored in `old-pump-contact-profile.js`; playback only interpolates this table. `old-pump-vane-geometry.js` provides the common geometry for generation and rendering, so the generator does not depend on its own output.

Maximum fold is **118.8636 degrees**, reached at **136.5 degrees** of clockwise rotor travel. A pocket in the rotor's central layer admits this fold; the front/rear cheeks still support the hinge pins and connect them to the shaft. After the closing maximum, the vane holds its fold until 145 degrees, then follows a quintic return ending at 178 degrees. This opens a positive gap before return and avoids the instantaneous branch jump that would occur by choosing the smallest collision-free angle independently at every frame. The opposed vane repeats the same sequence half a turn later; both are never folded simultaneously.

The contact branch has continuous position. Its entry and finite polygon feature changes can have velocity corners; their impacts are not dynamically solved. The hold/return is prescribed, with zero endpoint velocity and acceleration. A pressure field, spring or other physical return load has not been validated. This is finite geometric contact playback, not a passive fluid/contact simulation.

## Evidence

A 361-pose rendered-solid sweep measures these minimum separations:

| Pair | Minimum separation |
| --- | ---: |
| Sealing lip / abutment | 0.0001501 |
| Vane blade / abutment | 0.0005193 |
| Vane blade / rotor pocket | 0.0039416 |
| Sealing lip / casing | 0.0000556 |

The small abutment gap is the explicit 0.00015 numerical tolerance. An independent 1,440-pose edge/contact audit verifies clearance through closing, hold and return. During engagement its gap stays below 0.0003 and the closing hinge moment arm stays above **0.78** model units (offline minimum 0.78695). The same normal opposes clockwise input, rather than requiring an adhesive or pulling contact. These checks establish a finite load-bearing closing flank, not just noninterference.

The former partial-contact regression now requires nonnegative abutment clearance, and the obsolete C2-through-contact assertion was replaced by position-continuity and smooth-return checks. State queries and updates retain scene and geometry identities; the six-second minimum playback, no-ground/no-fog configuration and finite port improvements remain.

`node --test tests/movement-455.test.mjs tests/movement-456.test.mjs tests/rotary-pump-455-456-solids.test.mjs tests/old-pump-455-contact.test.mjs` passes **27 tests**. The unchanged 456 checks remain included to guard the shared helper. Browser default/front/contact/rear views were compared with the engraving; all visible vertices remain inside the default view at 65 cycle samples. Artifacts remain in `/dev/shm`.

Sampling is not a proof for every possible pair and instant. Hydraulic pressure, elastic sealing, contact forces, impacts, return loads and water occupancy remain unsolved; no MuJoCo or fluid solver is claimed.
