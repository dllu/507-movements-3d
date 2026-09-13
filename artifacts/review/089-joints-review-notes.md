# 089: flange, wrist and crosshead joint correction

The eccentric's existing rigid-link equations give the intended circular
sheave-center path, small strap swing and rectilinear output. The actual
hardware did not implement those constraints: four front-facing studs did
not join the separated flange plates, the solid crosshead intersected the
rod eye, and the crosshead floated between guides that lay behind it.

The two flange plates now meet and share two bolts along the rod direction,
as indicated by the engraving's side-visible heads and nuts. Each plate has
real bolt bores. The neck ends below the bolt holes instead of filling them.
A single solid rod includes its bored eye; a pin passes through that eye and
two bored crosshead cheeks with axial clearance. The output stem begins at
the fork bridge, clear of the wrist pin. Two channel guides retain the
crosshead vertically and axially. The extended guide's support stays on the
base. The default cycle is four seconds, with the ground hidden.

Six focused tests check rendered joint closure through two cycles, velocity
against finite differences, closed native solids, actual triangle ray hits
inside the bores, and the fork/channel clearances. Analytic swing limits
bound the rod's complete motion between sampled poses. The camera envelope
uses 512 full-cycle samples plus a maximum-vertex-speed bound for motion
between samples. These checks cover the changed joints; they do not qualify
all of 089's existing hardware.

The final build and all 173 selected tests pass, including camera checks for
all 507 models. Ten final browser views are inspected, including the actual
desktop/mobile application and close-ups of both corrected joints.

The engraving still needs a proportion reconstruction. A front-view registration
to the strap width leaves the shaft center 20.2 source pixels from the reading.
The rendered cap is 40.3 pixels wide against roughly 83 pixels in the engraving,
and the flange is 76.9 pixels high against roughly 130 pixels. These approximate
manual readings have a 3-pixel uncertainty; the projection is not yet fitted. In particular, the
old shaft cap, eccentric offset, strap lugs and flange height are visibly
too small relative to the strap. The crosshead and frame complete the rod
beyond the source's broken-off end and are inferred. The existing strap
halves, split bolts, sheave bearing and shaft supports still need native
clearance and source review. 089 remains under review.

The initial capture retained a warning caused by importing a second Three.js
module in the inspection harness. It is preserved as diagnostic evidence;
the corrected harness uses the application's Three.js instance. Final build,
test, capture and source-hash results are recorded in
`089-joints-review-checkpoint.json`; baseline images remain separate.
