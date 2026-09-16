# Movements 183–184 — baseline review, reconstruction pending

The [source caption](https://507movements.com/mm_183.html) replaces the diagonal
catch of 181–182 with two quadrants. These remain the next mechanism to rebuild;
the current implementation is `src/simulation/authored-quadrant-catches.js`.

The front-view comparison exposes several concrete rendering and geometry
problems. A large added grey guide and frame surround the mechanism, while the
orange piston rod covers only part of the sectioned extent drawn in the source.
The ground and its shadows are visible. White contact spheres and quadrant
indices are added explanatory markers rather than engraved mechanical parts.
The default oblique view makes source comparison harder.

The two quadrants belong to their respective handles, but their prescribed
motion, nominal point-contact calculations and separate depth layers do not
establish that finite working surfaces drive and retain each other. The current
183/184 tests extensively check those calculated states and even require the
added markers and framing. Passing them is not evidence of a physically correct
latch or a faithful visible assembly.

The [finite-solid baseline](validation/183-current-solids.json) checks 57 meshes
across 1,200 different-body pairs at 65 poses, with 27,342,444 surface queries.
It detects penetration between the upper retaining pin and lower quadrant
band (0.0878 model units), as well as crossed handles, the rod and guide, and
shafts passing through unbored hubs and arms. The outline meshes also contribute
overlaps. This is sampled evidence of real geometric defects, not a complete
collision proof. Run `node scripts/review-quadrant-catch-solids.mjs`; its current
nonzero exit is expected until these defects are repaired.

Next work: reconstruct the finite quadrant contact profiles against both
engravings, test both passive transfers with only the piston driven, and bake
qualified motion. Reuse the finite-plate, native-study and assembly-audit tools
from 181–182. Replace the partial rod and added guide with a source-width rod
section, remove the added frame/markers/ground, and inspect the source view,
orbit, full cycle and mobile layout. Keep useful joint and kinematic tests;
replace assertions that merely preserve the obsolete presentation.

The baseline captures are temporary RAM artifacts, not shipped assets. Neither
movement has been qualified by this initial inspection.
