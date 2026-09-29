# Movements 183–184 — baseline review, reconstruction pending

The [source caption](https://507movements.com/mm_183.html) replaces the diagonal
catch of 181–182 with two quadrants. These remain the next mechanism to rebuild;
the current implementation is `src/simulation/authored-quadrant-catches.js`.

The front-view comparison exposes several concrete rendering and geometry
problems. A large added grey guide and frame surround the mechanism, while the
orange piston rod covers only part of the sectioned extent drawn in the source.
The added ground and floating contact spheres have now been hidden in both
variants; diagnostic contact coordinates remain available. White quadrant
indices still remain and are explanatory markers rather than engraved parts.
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
section, remove the remaining added frame/indices, and inspect the source view,
orbit, full cycle and mobile layout. Keep useful joint and kinematic tests;
replace assertions that merely preserve the obsolete presentation.

The baseline captures are temporary RAM artifacts, not shipped assets. Neither
movement has been qualified by this initial inspection.

## Bounded native contact diagnosis

The [unqualified native study](../src/simulation/mujoco-quadrant-catch/README.md)
uses two passive handle hinges and one driven piston. Its inferred axial pins
and circular quadrant rims are **not ready to replace production playback**.
The [one-cycle diagnostic](validation/183-quadrant-contact-study.json) records
five cases, including each retaining pair disabled separately and shoe-only
contact. Run `node scripts/probe-quadrant-catch-transfer.mjs` to reproduce it.

The original inference releases too late: the driven lower handle reaches
about −0.956 rad and leaves the shoe before the upper handle is released.
Moving the release earlier exposes incompatible pin/rim sweeps. Removing the
lower pin allows the first upper swing, but then the lower handle falls back
and the upper pin blocks the return. Removing the upper pin leaves the other
pair blocking the upstroke. Shoe-only contact loses the intended sequencing.
No contact deletion, mass adjustment, or solver tuning is accepted as a fix.
The next contact reconstruction must make the two pin sweeps compatible and
hand over support before the driven handle leaves the shoe.

The contour tool extracts the two source crops in about 0.01 seconds each.
Joined ink boundaries expose the visible rims, but cannot recover the hidden
retaining faces. Use ideal circular rims and explicitly inferred hidden faces;
there is no need for prolonged pixel tracing. Existing source residuals and
finite-solid intersections remain open. The older finite-solid report predates
the presentation-only ground/marker change; physical meshes were unchanged.

## Pass 101: upper handle throw

The caption makes 183/184 a modification of 181/182, where the released upper
handle is pulled up by its back weight far enough to open the upper steam and
lower eduction valves. The site has no animation for 181–184. The old 10°
upper stop barely opened those valves, so it is now 30° (`upperFreeStop`,
rebaked table). The limit is Brown's geometry: the drop begins while the
tappet is still rising past 124 px, and the swung C-arm first meets it there
at 33.5°. 181's 55° would carry the C-arm into the tappet. The descending
tappet now bears on the C-arm from about 141 px to 270 px and turns the handle
back through the full 30°. The C-arm's two root edges now leave the boss on
tangents, so no shelf stands proud of the hub. The lip screen still flags the
curved arm's root (0.09, `-u`), because it measures a straight-rod section
across a curling arm; the zooms show a flush tangent join.
