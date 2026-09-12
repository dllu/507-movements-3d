# Movement 087: weighted self-reversing clutch

An isolated 207-part candidate corrects the definite driver-axis mismatch in
the unchanged production model. The source shows a face-on ring behind B and C,
in the same relative plane as E and the linkage. Production has a vertical
input shaft and an upper edge-on cone. The earlier three-view production
baseline remains in `087-inspected-baseline.json`.

A later [native edge check](087-native-contact-notes.md) identifies a small
stud/G overlap at the measured source pose that the sampled static screen
below missed. The historical sampled results remain valid as samples, but
they do not establish a collision-free source pose.

The new native crop from Brown PDF page 30, printed page 26, preserves all
pixels in the drawing. Fourteen circle fits retain their individual readings,
rejections and missing samples. The crop and measurement overlay are inspected.
Visible joint centers now place F's connecting pin above its fulcrum, with a
fixed-length rod to G. The input ring is larger than E. Both wheels have real
openings; E has four spokes and its measured central cap and stud. The curved
slot is cut through the quadrant. Hidden input spokes, spindle bearings and
an output shaft ending inside E's pinion complete the first static model.

The gear counts (42:30 for the main pair, 36:30 at E), hidden depths, supports,
jaw count/profile and materials are reconstruction assumptions. Upper-arc
circle fits do not establish pitch circles. The common main shaft axis is
aligned with F's fulcrum in X and the drawn horizontal shaft in Y; this differs
slightly from the free circle fit to the irregular engraving. Bevel teeth use
the existing Tredgold back-cone involute approximation, with conical heel/toe
surfaces and analytic cap normals. This is not an exact generated octoid.

Static checks pass on the final candidate:

- All 207 Float32 solids are closed, consistently oriented, edge-connected
  and nondegenerate, with positive volume and matching stored normals.
- Across 361 diagnostic poses, the rod length and transformed pin centers
  agree within 1.8e-15 world units. The output shaft retains its X axis.
- The bevel screen checks 2,362,308 native surface samples in both directions
  over one tooth pitch for each pair. There are no sampled intrusions; minimum
  gap is 0.000730958 world units. Loaded contact remains to be solved.
- At the measured source pose, 17,578 of 17,740 independent part pairs have
  separated mesh bounds. The other 162 pairs pass 1,259,886 bidirectional
  surface samples without intrusion beyond 1e-6. This is one static pose,
  not a continuous or complete reversal-clearance guarantee.
- Ten final browser views are inspected: source, overlay, front, oblique,
  rear, three details and two reach diagnostics. No browser errors or
  unexpected warnings occurred. No performance qualification is claimed.

The failed intermediate geometry is retained with exact source snapshots.
Checks found a microscopic sphere seam, a key extending into the loose jaw,
and a keyway deeper than D's narrow waist. Those defects are corrected. The
initial jaw flanks also crossed because each broad twisted face used one
radial band. Eight radial bands and 0.0003 axial relief (0.09 source pixels)
remove that static interference. The relief is an explicit candidate choice;
it does not establish force-transmitting jaw contact.

The reversal mechanism remains unresolved. In the measured four-bar, F reaches
vertical after 42.14895 degrees of travel. At about 47.40541 degrees, G moves
outside the entire swept outer envelope of E's stud. A symmetric flip would
require 84.29791 degrees, where the finite G plate is clearly unreachable.
This exclusion uses actual G cap triangles, not an infinite lever line.
A negative radial gap establishes only possible reach, not a valid contact
path. The result rejects that simple symmetric-flip interpretation for the
current measured linkage; it does not prove the historical mechanism impossible.

The curved quadrant may provide lost motion or adjustable stops, but its
coupling to the weighted lever and clutch shifter is not established. Those
three coordinates remain independent. No slot follower, gravity trajectory,
stud-driven reversal or automatic clutch-shift law has been invented to hide
the discrepancy. Further source interpretation and a mechanically consistent
coupling are required before dynamic contact, gravity and full clearance can
be qualified.

`087-source-geometry-checkpoint.json` records the current evidence. The candidate
is not integrated. All 1,097 inputs frozen after the verified 086 integration
are unchanged, as are the 082/083 study sources. No new production build,
full-suite test or all-507 browser pass is claimed. The complete review remains
active.

A subsequent [slot-coupling study](087-lost-motion-notes.md) preserves this
measured candidate and explores a separate 213-part operating hypothesis.
It resolves sampled hardware collisions and identifies the return contact's
force-direction constraint, but requires substantial rod-pin changes and
still has no qualified reversal trajectory.
