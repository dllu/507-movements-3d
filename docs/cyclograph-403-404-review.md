# Cyclographs 403–404: finite contacts around exact drawing laws

[403](https://507movements.com/mm_403.html) uses a rigid three-rule frame on
two fixed pins; its official animation provides a visual reference.
[404](https://507movements.com/mm_404.html) provides a static engraving and
caption, without an official animation. No decorative outline tracing or live
physics is needed for these bounded corrections.

403 retains the exact inscribed-angle circular locus. The guide pins and pencil
barrel have equal radii, so moving each rule face outward by that radius makes
the finite cylinders tangent without changing their centerline geometry.
The crossing collar has a real pencil bore, the pencil point reaches the drawn
arc, and the transverse brace clears the stationary guide pins above them.
The opaque drawing board is removed; construction lines remain.

404 keeps its fixed roller axes, but locates them along the normal of the
maximum-bend circle. A scalar contact solve finds the sliding tangent point and
vertical displacement at each intermediate bend. The source's maximum circle
and two-to-one depth taper remain exact. Roller rotation includes the change
in contact-normal direction as well as material uptake. The central thrust pad
has a rounded contact nose; the original broad flat pad intersected the bar.
Closed square screw threads, complementary nut threads and a through-bore in
the base reuse the existing thread and bored-journal helpers. The base is lowered
to clear the moving overhangs. The displayed reference arc also now spans the
correct three prescribed points.

Both models use a source-facing initial view, sampled whole-cycle bounds,
no ground, and fog-free materials. The physical depths, equal pin/pencil radii,
rounded pad, screw section and support clearances are reconstruction choices,
not dimensions supplied by Brown. 404's intermediate bending family and hand
adjustment remain prescribed: no elastic constitutive law, stress, springback,
friction, torque or loaded thrust-bearing dynamics are claimed. Its constant
outer-edge polyline length is a geometric model, not a finite-element solution.

Validation includes the existing exact-locus, length, lead and rate tests;
129-pose checks of rendered rule, roller and thrust-pad contacts; a negative
control that detects 404's old vertical-offset roller placement; and sampled
actual screw-thread/nut/base triangle clearance. The rate finite-difference
tolerance is 1e-8 rad/s after adding the contact root solve. The reduced end
uptake comes from the migrating contact stations. These are selected working
interfaces, not an exhaustive all-object collision certificate.

All 21 focused tests pass. Final default and oblique Chrome views were checked
against the engravings; full-cycle visible-vertex sweeps remain inside the
viewport. Packaged playback and mobile resizing also pass for both models.
