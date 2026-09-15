# Movement 145: rocking beam and tied rod

The [engraving and source animation](https://507movements.com/mm_145.html)
give a four-unit crank, a 24-unit primary rod, a tie point 15 units from the
crank, a 20-unit upright connecting rod and a 13-unit beam radius. The existing
analytic linkage closes these constraints and follows the source animation's
continuous clockwise wheel rotation. The complete beam extends beyond the
engraving's right edge, as in the site's animation; it is retained in the
zoomable model. The source corrects Brown's “left” standard to “right.”

Both connecting rods are now rigid flat plates with actual bored eyes. The
primary rod's third hole is at the tie point, rather than the midpoint. The
rocking beam tapers from its central boss toward both ends and has three bores.
The axle ends behind the primary rod; the flywheel support has an actual shaft
bore. Pin retainers clear the moving rods and beam. The standard's foot has a
channel around its guide rail, and its braces and the rear column's foot clear
the rail and moving foot.

The presentation uses an eight-second wheel revolution, a nearly frontal
default camera, exact restart and no fog. Separate ground ledges leave space
for the wheel below the source floor line; the application's extra ground
plane is hidden. Geometry is built once and then moved analytically, without
browser physics or per-frame mesh generation. No MuJoCo solve is needed for
this determinate linkage.

The caption describes the beam driving the flywheel. As in the site's
animation, playback prescribes wheel rotation and computes the corresponding
beam and standard positions. This demonstrates the geometric cycle; it does
not predict flywheel acceleration or prove that an arbitrary prescribed beam
force carries the mechanism through its reversals. Axial spacing, rear column,
bearings and guide construction are reconstructed from the planar reference.

Validation includes the existing kinematic test, actual pin/bore surface checks
at 65 poses, and [full assembly evidence](validation/145-assembly.json) at 129
poses. The assembly check covers 44 visible meshes, 762 independent part pairs
and 4,812,732 bidirectional surface-point checks with no detected penetration.
Same-body joins are excluded; sampled vertices, edge midpoints and triangle
centers are not a continuous swept-volume proof. The production build and
packaged desktop/mobile playback, orbit and exact restart pass without loading
WASM. Frontal and oblique screenshots were reviewed.
