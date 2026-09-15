# Movement 175: branch-transfer crank — reconstruction open

The existing analytic motion agrees with the executable animation on the
[original page](https://507movements.com/mm_175.html), but its visible assembly
needs rebuilding. The front view now uses a nearly orthographic camera, ignores
scene fog, hides the scene ground and supports exact Restart. The eight-second
two-turn cycle is retained while geometry is reviewed.

## Independent source evidence

The [oracle audit](validation/175-oracle.json) executes the original animation
library and movement callbacks at 1,441 phases across two crank turns. Maximum
coordinate disagreement with the existing analytic solver is 2.53e-14 in model
units. No live physics is needed to reproduce this reference motion. Choosing
the continuing branch at the tangent configuration is an explicit kinematic
assumption, not a demonstrated passive dynamic transition.

The original animation uses crank radius 5, guide offset 7 and rod length 12.
The equality L = offset + radius permits the two guide/circle intersections to
coalesce at the leftmost crank position. Measured engraving landmarks instead
give radius 77.01 pixels, offset 155 and rod length 163.69; the corresponding
branch-transfer rod would need to be 232.01 pixels. Registering the current
model to the engraved shaft and crank radius leaves its slider pin 69.87 pixels
from the engraved pin. This is a source discrepancy, not a numerical solver
error. The current tall, narrow frame also differs visibly from the engraving.

The caption's “one complete revolution” per stroke is not literally reproduced
by the original animation: successive piston reversals enclose 1.36491 and
0.63509 crank turns. Their sum is two turns per full piston cycle. Preserve
this distinction when describing or changing the reconstruction.

## Existing solid interference

The [finite-solid baseline](validation/175-existing-solids.json) checks 21 meshes,
all cross-rigid-family pairs and 129 poses. It performs 6,178,026 surface queries
and finds 11 interfering pairs. The shaft passes through the unbored crank,
link pins pass through unbored rods, and the slider shoe hits the rounded guide
end and its decorative outline. This report deliberately records failures;
it is not clearance certification. Same-family decorative overlaps are outside
its scope.

The production build and packaged Chrome desktop/mobile checks pass playback,
exact Restart, orbit/reset, no horizontal overflow, no WASM requests and no
page errors. These checks establish rendering behavior only. The front image
was inspected beside the engraving and confirms the geometry mismatch.

## Next work

Rebuild finite bored links and supported pins, replace decorative outlines with
real edges, fit the frame independently, and choose/document a constrained
source fit that preserves the branch-transfer mechanism despite inconsistent
engraving dimensions. Qualify full-cycle guide clearance and the tangent branch
transition. Keep 175 open; the full 507-movement review remains active.
