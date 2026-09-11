# Movement 075: current continuous-contact correction

The 2026-09-11 correction replaces static pawl snapping with continuous
overtravel, gravity drop and settling, and replaces the rod slot with an
ordinary circular pin joint. See [the current verification](075-continuous-motion-notes.md).
The older implementation and its verification below are superseded.

# Movement 075: superseded static-contact reconstruction

Final verification is complete in `075-integrated-checkpoint.json`. All 794
frozen source hashes match, and all seven focused tests, 3,062 numerical tests,
31 browser checks and the production build pass. The browser sweep rendered
all 507 entries. Thirteen integrated mechanical and UI images are inspected
and hashed. The eighteen historical UI images were restored after preserving
the fresh regression images separately. The full project review remains active.

The replacement now has a curved moving pawl, an independent fixed holding
pawl, a truly bored wheel and carrier, and a finite pin sliding in a real
radial slot. The 34-tooth profile regularizes the engraving's uneven spacing.
Both source nose positions fit within four pixels in the enlarged source;
nearest-crest distances are 14.081 pixels RMS, with a 35.936-pixel maximum.
This is a reconstruction, not a claim that every drawn tooth is identical.

The initial frictionless point-contact studies failed. Source-aligned gravity
and Coulomb contact produced feasible loaded motion; the selected model uses
coefficient 0.2 and an opposing torque of 2.2 with moving-pawl mass normalized
to one. The actual finite mesh masses preserve clockwise gravity closure.
Inertia is omitted. The default input cycle is 2.4 seconds.

The first finite candidate contained a detached holding-tip island. Joining
the two contours to the actual nose center fixed that island. A further
Float32 contour cleanup removed two near-zero-area cap triangles. All 14
final candidate meshes are connected, closed, outward and nondegenerate.
The 69-pose independent-family audit contains 21,004,344 surface checks with
no penetration over 1e-6. Independent finite section checks cover 1,028 poses
across four wheel cycles, with maximum contact gap 6.5615e-7. All sampled
reactions are compressive and sliding friction dissipates energy.

The production model matches the candidate's geometry buffers byte for byte
and its world matrices and motion scalars at 4,100 poses. The final regression
and UI evidence described above passed against the source versions preserved
in `075-verification-source-hashes.json`.

Earlier candidate images used different camera framing from the source. The
first source-aligned capture was overwritten by the engine's animation-frame
render; 075-aligned-candidate-source-aligned.png fixes the capture harness by
stopping that callback before rendering the orthographic comparison. This
change affects the diagnostic capture only. All failed studies are retained.

# Movement 075: baseline diagnosis and source study

The [official source](https://507movements.com/mm_075.html) describes a
rectilinearly reciprocating rod C driving the wheel through vibrating bar D
and pawl B. Its animation is unavailable. Brown's printed page 22, PDF page
26, is preserved as `artifacts/reference/brown-075-detail.png`.

The existing implementation has a short working pawl and a large counterweight
arm, with no independent holding pawl. The engraving instead shows a curved
moving pawl B and a separate curved holding pawl on an upper-right fixed pivot.
The existing test explicitly forbids that holding pawl based on an incorrect
source interpretation. Both original factory and test are archived.

The 102-pose selected hardware audit found 56,870 penetrating surface samples
in 794,758 checks between independently moving parts. Another 4,998 overlaps
occur between the co-rotating wheel and its shaft; those may be treated as an
integral join, although the intended circular bore is absent from the mesh.
The finite rod pin enters the solid bar under the painted
slot, and the slot decoration itself intersects the pin. Central interference
has two additional causes: the ratchet's nominal circular bore has only two
XY points (`curveSegments: 1`), and the carrier hub's bevel shrinks its bore
from 0.115 to a minimum vertex radius of 0.0933175 around a 0.105-radius axle.
Four independent points inside the nominal ratchet bore classify as wheel
material. The existing working catch clears the ratchet in these sampled
poses and supplies a clockwise driving moment during the prescribed stroke;
this does not verify free pawl equilibrium or holding during return.

The source wheel-face circle fits to 1.659-pixel RMS and the central shaft
circle to 0.603-pixel RMS. Initial manual tip marks included one hidden behind
C and several inaccurate positions. Automatic radial refinement also selected
adjacent pawl ink at three locations; the inspected refinement corrects those
points. The reviewed outer-ink tip circle has 3.336-pixel RMS, with 31 direct
readings, one excluded estimate behind C, and a further hidden crest behind
B/D. A 33-tooth reconstruction is plausible, but the exact count remains
provisional. The initial, automatically refined and reviewed overlays are
preserved separately. The first SVG raster omitted the embedded source image;
the linked SVG uses an explicit XLink image reference and is inspected.

The source draws a round joint at C/D but gives no detail accommodating a
strictly rectilinear rod and a rotating bar. A real short radial slot beneath
that collar is a possible reconstruction. It must be sized, bored and checked
as an actual sliding joint; a painted slot or an unconstrained fixed pin is
insufficient. Moving and holding pawls need finite contact geometry, gravity
or other justified closing forces, and clearance through every return stroke.
The manually read pawl bodies both have centroids to the right of their
pivots. Their gravity moments turn clockwise, moving the tips toward the
wheel; centered pivot heads would preserve that sign. This supports testing
gravity closure, but does not establish full-stroke contact or equilibrium.
No replacement geometry or motion is accepted yet. Eight baseline browser
frames are inspected and preserved, including front, oblique and rear views
and the drive/return strokes. The accepted diagnosis and source records are
linked from `075-reconstruction.json`.
