# Movement 086: cam-released loose-wheel pump

Status: **rear drive and catch reset reconstructed; refinement and full hardware pending**. The
replacement is incomplete and unintegrated. Production remains at the 972-input
movement 085 checkpoint; the all-507 review remains active.

The [original description](https://507movements.com/mm_086.html) specifies a
continuously rotating shaft and cam C, a loose wheel A carrying a hooked catch
B, and a rope lifting a pump rod. A fixed overhead stop releases the catch;
the pump bucket's weight returns the wheel.

The native Brown engraving is extracted from PDF page 30, printed page 26,
at `[400, 1160, 1200, 1240]` in the 4814 × 6000 page image. The complete
mechanism and numeral are retained. `086-source-provenance.json` records
the original scan, page and crop hashes. Both the native crop and official
website image were inspected.

## Rejected baseline

All ten baseline views were inspected. The large central drum, rounded cam
and separate round contact pads do not match the source. The source has a
slender pointed cam inside a hooked catch, a broad pierced front bearing
standard and a wider wheel rim. The existing model also places its bearing
frame behind the wheel and adds a conspicuous bucket below it.

The finite diagnostic checks 58 visible meshes across 136 poses and 1,162
independent pairs. Among 18,820,946 surface samples, 588,297 penetrate another
family beyond 1e-6 world units. The worst conservative depth is 0.107027022,
between catch B and the cam body. Other failures include the shaft intersecting
the bearing legs and solid drum, rope intersecting the pivot stud and drum,
and the pivot pin lacking a proper catch bore. The wound tube has open ends;
it is sampled as a source surface but excluded as an interior target.

The analytic cam-contact error is only 2.29e-16, but its normal passes through
the shaft axis. Across 31 engaged poses, the maximum moment arm is 4.44e-16.
This frictionless contact cannot supply the clockwise torque needed to lift
the pump, whose prescribed rope drum requires a torque arm of 0.78 per unit
pump weight during constant-speed lift. An accurate distance between the
round pads therefore does not establish a working mechanism.

The animation also holds the rendered wound rope stationary while its reported
wound length changes by 1.078194599 model units. The baseline's shaft cycle is
8.055 seconds internally and two seconds after display scaling. See
`086-baseline-surfaces.json` and `086-baseline-captures.json`.

## Source measurements and core reconstruction

Bounded dark-stroke fits retain all readings and rejected outliers. The outer
wheel radius is 332.536114 pixels, from 103 accepted readings with 2.047617-pixel
RMS residual; the inner radius is 248.301996, from 76 readings with 1.656407-pixel
RMS residual. Their fitted centers differ by less than one pixel.

The front bearing fit has center `[614.539128, 613.582744]`, radius 55.438641
and RMS residual 1.145943 pixels. This center is adopted as the common shaft
axis. The shaft radius is 36.883412 pixels. The catch pin center is
`[346.236476, 596.590059]`, radius 13.252532 and RMS residual 0.510437 pixels.
The measurement overlay was inspected before adoption.

Manual contours at 240 source pixels per world unit reconstruct the hooked
catch, pointed cam, curved spokes, front standard and its rounded triangular
opening, overhead beam/post, trip stop and base. The initial candidate has
thirteen closed solids, independent wheel/cam/catch families, an ordinary
catch pin with a real bore, and clear shaft passages through the wheel and
fixed bearing. Hidden depths, cam root and spoke completion are assumptions.

All seven candidate views were inspected, including an exact source overlay,
front, rear, oblique and contact details. The principal contours closely follow
the source. These images qualify the initial geometry study only. Final
shadow styling and the small color fringe visible through the shaft bore
remain rendering details to assess with the complete assembly.

All 56 independent core pairs were screened at 34 prescribed diagnostic
poses, using 1,873,970 surface samples. No intrusion beyond 1e-6 was detected.
All thirteen meshes are closed with outward winding. The coupled sweep keeps
the relative catch/cam pose fixed and is **not solved contact motion**; it
does not qualify release, return or complete continuous clearance.

## First finite contact

The actual cam and hook cap triangulations and side faces form complete
constant-depth prisms. Rotating only the cam clockwise from the source pose
reaches the hook at -0.054910540 radians, approximately 3.146 degrees.
Independent cap intersection and boundary checks locate contact within
1.71e-9 world units. Both mesh normal cones admit the same compressive normal.

The resulting shaft-axis moment arm is **-0.860326372**, with negative denoting
clockwise torque. This remedies the baseline's radial contact geometry. The
catch-hinge moment arm is -0.207785264. A slightly advanced cam penetrates the
hook, while a slightly withdrawn cam clears it; both controls pass. This is
geometric seating evidence, not a force equilibrium or dynamic lift proof.
See `086-first-cam-seating.json`.

## Contact and pump dynamics diagnostics

The new studies solve wheel angle, absolute catch angle and, in the latest
model, independent pump height. Uniform mesh density supplies the wheel/catch
mass and inertia; normalized pump mass 1, gravity 9.81, a four-second input
revolution and zero drag are diagnostic assumptions. Signed tetrahedral
integration of 6,608 actual mesh tetrahedra checks energy and all three
momenta at 51 poses. Maximum energy/momentum errors are below 3.60e-14;
finite-difference Euler–Lagrange residual is 1.50e-10. This verifies formulas,
not the accuracy of a complete trajectory.

The original two-coordinate taut-rope trial is rejected: it requires negative
rope tension (-3.767439) and includes nine invalid reaction normals. Separating
the pump coordinate permits slack and positive tension, but an unlimited-wrap
rope plus a prescribed lower stop lets the wheel unwind indefinitely. These
trials and the nonlinear corner failures remain archived.

Two contact errors were isolated independently. First, using adjacent cone
rays for separated vertices creates forces across empty space. The rejected
eight-second corner trial contains 537 invalid reactions, with separation up
to 0.005740088. Multiple normals are now restricted to coincident corners;
separated points retain the actual closest-point direction. A two-circle
closure proposes a shared cam/hook corner only when the same nonnegative
mass-metric impulse solve reproduces that pose.

Second, discarding a penetrating trial feature because its normal is
inadmissible can hide a return collision. The current solver retains trial
escape constraints and independently rejects a negative raw boundary gap.
The historical bad return pose at 2.723 seconds has 0.008981260 penetration;
the new guard detects it. All 508 guard/control poses pass, with no falsely
clear penetrating poses. Final reaction normals still require independent
mesh checks; an escape constraint is not itself a qualified contact force.

## Finite attached rope and remaining motion failures

The new ideal rope has finite length 4.75 model units, an assumed rim pin at
the source pose's left tangent, and a vertical pump guide under that tangent.
The winding radius is 1.273079700, measured from the source axis to the visible
rope centerline. The rope can unwind, leave a straight free span, and wind
onto the opposite side; complete turns retain their winding count. The
source omits the attachment and bucket, so these details remain explicit
reconstruction assumptions. There is no prescribed pump stroke stop.

Independent polygonal length and finite-difference gradient checks pass at
805 poses across all three winding modes. Maximum length difference is
2.22e-8, and maximum derivative difference is 2.54e-9. Full turns consume rope
instead of accumulating unlimited slack. Rope and pump meshes are not yet
constructed.

The first finite-rope eight-second run passes all 11,395 reaction checks and
a 101-pose core screen with 6,119,084 samples. It is nevertheless **rejected**:
complete cap-triangle intersections at 16,181 knots/midpoints find 118 cam/hook
overlaps above the 1e-10 area threshold, with maximum area 0.000333301.
The 1 ms and 0.5 ms solutions also disagree badly: the conservative projected
mesh-displacement bound reaches 9.168 engraving pixels during engagement
and 1,123.758 pixels over eight seconds. Passing sparse surface samples and
individual forces did not establish working motion.

With the raw-gap guard, the latest three-second run contains 3,061 states.
All 5,264 reactions pass common mesh boundary, normal-cone and momentum checks;
maximum boundary error is 8.42e-10. The thirteen core solids and all 56
independent pairs pass 6,246,092 surface samples at 101 solved poses.
The denser 6,121-pose triangle screen still fails its strict area threshold
at 20 cam/hook poses. Maximum overlap area is 5.174001e-9, at an interpolated
midpoint at 2.7275 seconds. Shaft/hook and stop/hook pass that screen. Continuous
clearance and time-step agreement for the guarded solver remain unqualified.

The first polygon-union overlap audit failed while stitching almost
coincident output edges. Its exact script and log are preserved. The current
audit clips individual rendered cap triangles, whose interiors do not overlap,
and sums their intersection areas. Identical, clear, penetrating, shared-edge
and contained-triangle controls pass. This avoids the ring-stitching failure
without snapping or displacing the source geometry.

## Impact velocity and exact-face corrections

The next review confirms the intended sequence in the [original description](https://507movements.com/mm_086.html):
the rotating cam seizes the catch, the overhead stop releases it, and the
bucket weight returns the loose wheel. The source image was inspected again.
The previous diagnostic checkpoint was substantive progress, but it did not
establish that this sequence repeats.

A work audit exposes a defect in the position-only projection: a seated
contact can retain a closing velocity. Absolute contact drift work is 13.918%
of the work/loss scale in the guarded three-second 1 ms run. Refining the old
solver to 0.25 ms for twelve seconds does not cure it: drift work is 21.640%,
and the intended full lift is lost. Both are rejected.

The new impact solver first locates the finite contact position and then
projects free momentum onto the final unilateral velocity constraints.
Position transport and physical post-impact velocity are stored separately;
the force audit checks momentum with physical velocity and position with the
recorded transport. The new three-second 0.5 ms run passes all 9,625 reactions,
with maximum common-boundary error 3.87e-14. Absolute contact drift work falls
to 1.24e-14. Signed and absolute integration defects are respectively 0.05894%
and 0.13639% of the work/loss scale. These are numerical diagnostics, not a
continuum-error guarantee.

A separate feature-preservation regression identifies another error. Dividing
a tiny point-separation vector amplifies roundoff enough to reject a valid
face from its own normal cone. Interior-edge contacts now use the exact face
normal. Across 1,460 rotated approach/penetration controls, the previous method
loses 62 valid face contacts; the corrected method retains all of them, with
zero normal error and maximum tangential residual 2.75e-16. Separated corner
pairs still use their actual separation direction, and only coincident
corners admit multiple face normals.

Both 1 ms and 0.5 ms three-second impact runs complete without adaptive
subdivision. They are still **not accepted playback**: their maximum observed
mesh-displacement difference is 27.340 engraving pixels during startup.
The 0.5 ms knot/midpoint screen covers 12,001 poses and fails at one cam/hook
midpoint, with area 1.637367e-10 at 2.90075 seconds.

Further 0.25 ms and 0.125 ms startup studies retain a different capture path.
By 0.6 seconds their cams have lost contact, while the coarser runs are seated.
The two refined startups still differ by 15.229 engraving pixels. The finest
startup passes all 7,268 reaction checks and the 9,601-pose primary triangle
screen. Its signed/absolute energy defects are 0.00954%/0.02797%. Thus improved
energy and geometric contact checks do not establish the required hook
capture or cycle. Resolve that behavior before treating the coarse run's
apparent seating as correct.

Nine new rendered motion views were captured and inspected against the
engraving, with no browser errors or unexpected warnings. They show the
coarse run's seating, overhead trip, release and large return excursion;
seven views deliberately hide the front bearing to expose the contacts.
These are diagnostic inspections. The pump rope, load and rear input hardware
are still absent, and no final visual or repeated-cycle acceptance is claimed.
See `086-first-impact-motion-captures.json`.

## Rear input assembly and slower capture

The rear input candidate adds fifteen solids to the unchanged thirteen-part
core: two complete pulleys, a closed input band, shafts, rear bearings and
bases. The band radius and width follow the two visible hatched source runs.
The remote pulley, its spacing, hidden sections and supports are reconstruction
assumptions. Its inner polygon circumscribes the pulley cylinder so rotating
pulley facets cannot penetrate the band. Maximum radial rendering clearance
is 1.164785e-5 model units. Band material coordinates move with the prescribed
shaft; this is ideal no-slip kinematics, not a finite-traction calculation.

All 28 meshes are closed. All 285 independent pairs pass 14,181,018 surface
samples at 34 prescribed poses. The thirteen original meshes and wheel/catch
mass properties remain identical. Eight source, overlay, full-drive and detail
views are inspected, with no browser errors or unexpected warnings. The remote
pulley is complete and visible when the full assembly is framed. Belt markings
and final shadow styling remain cosmetic details for the integrated review.
See `086-first-rear-drive-surfaces.json` and `086-first-rear-drive-captures.json`.
This assembly is a separate candidate; it has not yet been combined with the
loaded dynamics or rope/pump hardware.

A retained cam/catch corner now seeds the next nonlinear position solve. It
is only an initial guess: the same unilateral force and finite-gap conditions
must accept the result. Ninety independent one-step controls cover capture,
release and free motion. Seeded/unseeded position, physical velocity and
transport agree below 1e-7, and the ordinary solve reproduces the retained
pre-optimization states. Sixteen expensive corner fallbacks are avoided.
The original and current controls are preserved separately.

Eight- and sixteen-second input periods retain initial capture at 0.25 ms.
The eight-second 0.25/0.125 ms startup comparison still misses the 0.25-pixel
target, reaching 0.290949 engraving pixels. A 24-second, three-revolution
eight-second-period run completes without subdivision, but the undamped wheel
and catch do not repeat the intended pump sequence. This is a rejected motion
candidate, even though its initial capture and overhead release look plausible.

## Loaded return diagnostic

Uniform catch thickness puts its center of mass on the tail side of the pin;
gravity initially opens the hook. A separate candidate adds 0.1 model units
of thickness behind the existing head silhouette, clear of the wheel. It
reverses the initial gravity torque from +0.033059 to -0.028163. This hidden
weight distribution is an assumption, not a detail stated in the source.
Independent integration of 7,024 actual mesh tetrahedra at 51 poses checks
the new energy and momentum formulas; maximum energy/momentum discrepancies
are below 3.6e-14 and the free-equation residual is 1.57e-10.

The load model now supports relative shaft/wheel bearing drag, relative
catch/wheel hinge drag, vertical pump resistance and a lower pump stop. All
are optional explicit assumptions. Hub friction exchanges work with the
rotating input shaft; it is not treated as a bearing fixed to ground. The
101-pose independent force/power control has maximum power residual 2.14e-14.

The sixteen-second trial uses an eight-second shaft period, 0.5 ms steps,
head depth 0.1, hub drag 1.5, hinge drag 0.02, pump drag 12 and lower stop at
pump height zero. Its 32,001 states complete without subdivision. All 64,587
reaction checks pass; the maximum common mesh-boundary error is 5.22e-14.
The 14-solids/68-pairs screen passes 5,290,338 surface samples at 101 solved
poses. All 64,001 primary cap-triangle knot/midpoint checks pass, with maximum
cam/catch overlap area 1.68e-13, below the 1e-10 diagnostic threshold.
Signed/absolute work defects are 0.36038%/0.37230%; contact drift work is
5.42e-15 in absolute sum. These checks do not prove continuous clearance,
time-step agreement or a working repeated cycle.

The trial is **rejected for repeated operation**. Its first revolution lifts
the load 2.589774 units; the second lifts only 0.001119. After return the catch
rotates away from the ready position, eventually presenting its tail to the
cam. Eight new motion images are inspected and preserve that failure; six
hide the front bearing for contact inspection. The new head thickness follows
the original front contour, but neither the resulting catch motion nor the
unmodeled rope/pump hardware is accepted. The missing reset mechanism needs
investigation, including whether finite wheel-mounted travel stops are a
plausible hidden detail. That investigation follows below.

## Finite heel stop and repeated loaded motion

The next candidate adds an actual cylindrical lug behind the catch head and
a small stop on the wheel, near the catch pin. The lug radius is 0.012, at
radius 0.11 from the pin. Both parts stay behind the existing front silhouette.
Their physical side faces meet at relative catch angle -0.120001515 radians;
the nominal design angle is -0.12. The solver uses these rendered faces and
their equal/opposite pin moments. There is no imposed angle clamp or reset.
The hidden stop remains an explicit reconstruction assumption.

Boundary, normal-cone, moment and finite-difference gradient controls pass at
101 rotated poses. Actual mesh checks place the lug within the head backing
and the stop footprint on the wheel rim. The new sixteen-part mass model also
passes the independent 7,344-tetrahedron energy/momentum check at 51 poses.

The first heel trial, retaining hinge drag 0.02, still misses the second lift.
The pump's bottom impact throws the catch outward despite the inward stop;
the second-revolution lift is only 0.000398 units. This failed trial is retained.
Increasing relative catch/wheel pin damping to 0.2 controls that overrun.
The remaining trial parameters stay at head depth 0.1, hub drag 1.5, pump
drag 12, lower pump stop zero and eight seconds per input revolution.

The resulting 0.5 ms, sixteen-second run completes 32,001 states without
subdivision. Both revolutions lift 2.589426891 units. Corresponding states
from 0.5–8 seconds and 8.5–16 seconds agree within 9.15e-14 in coordinates and
2.54e-14 in velocity. This establishes observed repetition over those two
cycles; it is not a long-term stability or continuum-error guarantee.

All 58,645 reactions pass common mesh-boundary, normal-cone, moment and
momentum checks. Maximum boundary error is 2.39e-14, and maximum independently
computed moment-arm error is 5.56e-16. All sixteen solids and 91 independent
pairs pass 6,032,478 surface samples at 101 solved poses. All 64,001 primary
cap-triangle knot/midpoint poses pass, including the new lug/stop pair;
maximum cam/catch overlap area is 2.38e-13, below the 1e-10 screen threshold.
Signed/absolute work defects are 0.26003%/0.26837%.

Nineteen new images are inspected: eight geometry/source views, three improved
oblique heel details and eight solved-motion views. The first two straight-on
heel details hide the lug's outline against its backing; the later oblique
views clearly show its opening and seating. The source overlay retains the
principal contours, and the motion images show both lifts and releases.
These remain candidate inspections; the rope and physical pump are absent.

## Contact-query robustness and pending refinement

A broad-phase regression exposed an existing crash at interior cap vertices.
The shaft disk's triangulated center has no side boundary and therefore no
planar contact normal. Such points remain in the raw penetration guard but
are excluded from reaction features. The original failing script, normal
helper and log are retained. The explicit interior-vertex regression now
passes, together with the existing exact-face controls.

A conservative box filter now skips distant closest-point calculations while
retaining the established narrow contact computation. Across 727 solved and
synthetic queries, complete feature lists and raw gaps agree exactly with
the ordinary calculation. Eighty-one full impact steps also exactly reproduce
the saved 0.5 ms trajectory. Measured query speedup is 2.59×; the filter does
not change geometry or prescribe motion.

The sixteen-second 0.25 ms study completes 64,001 states without subdivision
using that filter; its force and work audits also pass. The first 0.125 ms
run reaches sixteen seconds without subdivision, but summary construction
then exceeds JavaScript's spread-call argument limit. Its complete trajectory
was not published. The failed runner and log are preserved. A bounded summary
passes a 300,001-state fixture with independently known extrema, and the
0.125 ms run is being repeated with that reporting fix. The comparison verifier
permits only this exact summary replacement; all other study code and physical
inputs must remain identical. Time-step agreement and final independent audits
remain pending. See `086-heel-reset-final-study-checkpoint.json`
for the observed retry handle and retained evidence. The earlier
`086-heel-reset-study-checkpoint.json` records the state before this reporting
failure was observed. The all-507 goal
remains active.

## Completed heel refinement and its rejected agreement check

The retained 0.125 ms retry completes 128,001 states through sixteen seconds
without subdivision. All 233,332 reactions pass, together with the work audit
(0.06501% signed and 0.06746% absolute defect). The four primary pairs pass
256,001 cap-triangle knot/midpoint checks. Maximum cam overlap area is
9.61e-16 square units.

The 0.25/0.125 ms comparison nevertheless fails the 0.25-pixel agreement
target: its maximum is 0.401907335 engraving pixels during initial catch
seating at 0.3345 seconds. That failed report is retained. The completed
physical assembly below requires its own recomputed masses and refinement.

## Complete input, winding and pump hardware candidate

The new candidate combines the weighted catch and heel with the rear input
assembly. It adds a winding rim behind wheel A, a finite rope clamp, a closed
round rope, a sliding pump crosshead, output rod, hollow ferrule, two guide
rails, their supports and a lower bed. The crosshead passes through a real
opening in the joined front/rear plinth. Both rope ends stay attached.

Neutral winding radius 1.273079700 and rope diameter 0.125 follow the source's
visible rope position and width. The rear groove, round section, attachment,
guide frame and pump rod complete details omitted by the engraving. The
crosshead is an ideal vertical slider with normalized mass 1; actual moving
mesh volume determines its density. Pump internals are outside the source
scope. The rope remains massless, with exact analytic length 4.75. A smooth
forward bow displays otherwise undetermined slack while retaining that length
and the end tangents. It is not a finite-mass catenary solution.

The winding bed is relieved by 3e-6 units to accommodate the polygonal rope
sweep. Its added rim and clamp increase free-wheel volume from 0.592055741
to 0.748615615 and polar inertia from 0.655542600 to 0.888127665. Independent
integration of 21,584 signed tetrahedra at 51 poses includes the actual wheel,
catch and normalized translating pump meshes. Energy, momentum and free
equations agree within 3.82e-13, 5.91e-14 and 1.37e-10 respectively.

All 42 meshes are closed. The first prescribed screen passes 21,058,526
surface samples at fifteen poses. The textured version retains the geometry
and adds a continuous rope UV seam. A fresh 0.25 ms full-mass run completes
64,001 states and two lifts of 2.595421696 units, without subdivision. The
wheel overrun reaches 0.177111577 radians and maximum analytic slack is
0.224256370, so earlier core clearances are not reused as loaded qualification.
All 115,009 reactions pass actual boundary, normal-cone, moment and momentum
checks. Signed/absolute work defects are 0.12647%/0.13181%. The new twenty-pose
screen includes all coordinate extrema and passes 28,479,142 surface samples
across 704 independent and moving-family internal pairs without intrusion.

Thirty-one images are inspected: nine initial assembly views, ten textured
source/assembly/section views and twelve solved full-mass motion stills. The
first anchor detail is occluded by the rear input wheel; the later section
shows the clamp and winding channel. Both lifts, releases, guide travel and
slack phases are visible. Source framing preserves the measured main contours;
the omitted return pulley and lower output apparatus are complete in the
zoomable assembly. Ten motion frames hide the front bearing for inspection.

The independent rope-buffer audit retains a failure at 204 sampled poses.
Its worst polygonal centerline length is 4.749988352 instead of 4.75, a
1.164773656e-5-unit deficit (0.002795457 engraving pixels), just above the
1e-5-unit screen target. Section-radius error is 1.23e-7; clamp and crosshead
endpoint errors are 1.34e-8 and 2.22e-7. This is a display tessellation issue;
the analytic tension constraint still uses exact rope length. Refine the
display curve and repeat this independent check without changing the target.

The complete 0.125 ms study finishes 128,001 states without subdivision.
All 229,596 reactions pass, with signed/absolute work defects of
0.06407%/0.06633%. Its 0.25/0.125 ms comparison remains rejected:
0.301908623 pixels during initial seating and 0.317147574 pixels during
second-cycle engagement at 8.220125 seconds, against the unchanged 0.25-pixel
target. The complete-mass reports are retained separately from the earlier
heel-only study. Consult
`086-complete-hardware-study-checkpoint.json` for terminal observations and
the exact completed reports. No complete mechanical or production acceptance
is claimed. The sixty-three pump/catch scripts pass syntax checks; all 972
production inputs, the 23 original core inputs and current 082/083 study
inputs remain unchanged. All owned studies and browser captures are terminal.

## Refined complete motion and continuous hardware bounds

The full-mass 0.0625 ms run completes sixteen seconds and 256,001 states
without subdivisions, rejected trials or solver failure. Its comparison with
the 0.125 ms run passes the unchanged 0.25-pixel target: the maximum observed
rigid displacement bound is 0.224245599 engraving pixels at 0.346 seconds.
All 458,526 reactions and 402,798 boundary checks pass. Signed and absolute
work defects fall to 0.0317165% and 0.0330815%. The failed 0.25/0.125 ms and
earlier heel-only comparisons remain retained.

Only the massless display bow changes from 256 to 512 chords. An exact source
comparison permits that one-line change while rejecting altered analytic
length, winding resolution, bow shape, clamp tangent and unrelated text.
The repeated 204-pose buffer audit on the 0.125 ms trajectory now measures a
maximum centerline deficit of 3.613487363e-6 units, below the unchanged
1e-5 target. Both endpoints remain attached within 1e-6. Analytic rope length,
force law and rigid geometry are unchanged.

Compression retains 2,596 states and 2,595 linear playback spans. A weighted
absolute-angle displacement bound limits error against every original knot
to 0.001999018 pixels; convexity covers the original intervals between knots.
Each proposed span also passes actual prism-triangle bounds for catch/cam,
catch/shaft, catch/trip stop, heel, head/shaft, head/trip stop and lug/shaft.
Sixty-five otherwise accurate spans are split for clearance. The certificate
contains 6,209,818 certified triangle pairs. Observed step agreement plus
compression totals 0.226244618 engraving pixels. That total concerns rigid
coordinates and is not an exact continuum-error or rope-deformation bound.
Startup is retained; matching states and velocities support repeating the
settled 0.5–8.5-second interval with an eight-second physical period.

Whole-motion bounds certify the other 629 independent rigid pairs: 597 use
Cartesian separation, 29 invariant radial ranges, one the actual XZ triangle
projections and two the winding-band depth slabs. The seven prism pairs above
complete all 636 independent rigid pairs. Same-family relationships are fixed
and retain their earlier surface screen. Primary controls reject a collision
between clear endpoint poses; hardware controls reject closed bearing/guide
holes, an enlarged band bed and a displaced plinth passage.

Continuous display-rope bounds use linear available-length limits, a monotone
upper bound for the actual amplitude solve, and 128 slabs aligned with the
512 bow sections. Actual hardware triangles retain the guide holes and base
passage. Separate winding-depth, clamp-tangent and ferrule-bore checks cover
the attachments. All 41 other parts pass. An unmodified rerun passes; isolated
fixtures filling the plinth passage, crossbar slot and ferrule bore each fail
on the altered part. These bounds concern the supplied interpolated playback
and its ideal massless rope, with the documented 1e-6 mesh tolerance.

Five additional rendered views are inspected at 0, 2.69, 7.305, 10.69 and
16 seconds, covering the initial assembly, both lifts, slack and the oblique
ending. The three interior frames hide the front bearing for inspection.
There are no browser errors or unexpected warnings. These are candidate
stills; interactive playback and production acceptance remain pending.

`086-continuous-hardware-study-checkpoint.json` records the refined reports,
negative controls and retained earlier failures. It verifies all 972 production
inputs, the 23 original core sources and the current 082/083 studies unchanged.
No new production build or full numerical/browser-suite pass is claimed.

## Rope self-clearance, playback and event-timing study

The display rope now has a continuous self-clearance argument. Section planes
separate nonadjacent cells; positive closed-cell face determinants exclude
local folding. The winding arc stays below pi. Both the large slack bow at
the lower bed and tiny slack at every raised-pump height are covered, with
horizontal joins separating the constituent pieces. The full Float32 rounding
allowance is 8.259061849e-7 units, below the existing 1e-6 mesh tolerance.
Controls reject a full-circle overlap, an inward-folded bow and an oversized
section. `086-complete-rope-self-bounds.json` supersedes the first self-bound
report, which omitted the separate raised-pump quiet-bow domain.

The first full 3D rope agreement diagnostic finds a 3.106992478-pixel bound
near bottom arrival at 6.5204375 seconds. At that instant the 0.125 ms run has
already formed slack while the 0.0625 ms run remains taut. Compression adds
only 0.008975387 pixels. Separate front-projection bounds at the same finest
knots are 0.164431321 pixels for step agreement and 0.001700349 for compression.
Those smaller projected errors do not turn the retained full 3D failure into
a pass; nonlinear errors between time knots also remain to be bounded.

An isolated playback wrapper preserves startup, repeats the measured settled
interval at four display seconds per input revolution, and keeps the input
angle continuous so the drive-band texture does not jump at the loop seam.
The baseline browser run averages 20.85 fps with 6.1 ms p95 model updates.
Reusable rope buffers match every position, normal, UV and index exactly at
118 sampled motion/wrap poses, without reallocating the geometry. Exact tuple
indexing also reduces the 41 rigid parts from 253,020 to 102,898 vertices;
all 2,073,456 expanded attribute components match, including signed zero.
The initial indexer's signed-zero mismatch is retained separately.

The final optimized preview averages 22.64 fps with 1.5 ms p95 updates at
pixel ratio 2. Its renderer reports Vulkan SwiftShader software rendering;
no hardware-GPU performance claim follows from this measurement. Five baseline
and five fully optimized source, lift, oblique-slack and loop-seam stills are
inspected. Both captures span 12.2 seconds without browser errors or unexpected
warnings. The intermediate reusable-rope preview is also retained, but its
five stills are not counted as inspected.

A separate hybrid solver trial addresses the timing sensitivity. RK4 handles
free motion and the linear wrapped-rope, heel and bed constraints; the original
unilateral impact solver handles nonlinear cam contacts and contact events.
Independent elimination of the pump coordinate, then of the held heel,
reproduces its three-coordinate accelerations within 1e-12. Incompatible
initial velocities are rejected.

The first 0.5/0.25 ms hybrid comparison still fails: 0.591887482 rigid pixels
and 1.685172043 rope pixels, with the rope maximum now during cam take-up.
Bottom-arrival times agree to numerical precision. The 0.25 ms force audit
passes its endpoint reaction and stage momentum checks but finds an
intermediate penetration of 5.311662536e-8 units against the 2e-8 stage target.
Its signed/absolute work defects are 0.11177%/0.11595%, within the existing
thresholds. These failed trials remain retained. The next version checks every
RK stage against actual finite gaps and separately refines sliding-cam phases;
it requires fresh complete-motion qualification before use in production.

The first guarded runs are interrupted after demonstrating a refinement-mode
classification error: optional corner-seed metadata can be absent even when
two independent physical cam equations fix both angles. Four new controls
check the actual constraint rank, including a duplicated parallel-face case.
The interrupted logs and source snapshots are retained. Corrected full runs
use the `086-ranked-hybrid-coarse` and `086-ranked-hybrid-fine` prefixes.

## Completed fine hybrid study and geometric contact mode

The ranked fine run completes 16 seconds with 371,396 states, 42,738 smooth
steps and 328,657 impact steps, without solver failures. Its signed and absolute
work defects are 0.0967646% and 0.0968039%, within the unchanged thresholds.
All 728,394 endpoint reactions and 170,952 smooth stages pass the independent
force audit, including 713,386 actual boundary checks. The maximum stage gap
defect is 1.32943e-8, below 2e-8. The complete
591,704,242-byte decoded trajectory exceeds V8's single-string limit. A separate
reader parses complete row batches while retaining all data. It matches every
value of the earlier 34,513-row report and passes unicode, escaping, nested
members, tiny-batch, empty-array and malformed-input controls. This is an
in-memory reader; it does not claim bounded total memory.

The ranked coarse run exhibits repeated switching between cam contact and
free integration near 15.923 seconds. A bounded reproduction from a retained
earlier trajectory identifies the cause: the physical cam impulse can be zero
at a tiny step while the finite surfaces remain within their existing 2e-8
contact tolerance. The free integrator then repeatedly detects the same
closing contact. Its first cam entry is at 7.922723701477052 seconds; the
500-state diagnostic stops at 7.922735664367677 after 494 closing-contact
subdivisions. All diagnostic states and source snapshots are retained.

The coarse run is explicitly interrupted, with exit 130 and its log retained.
It had advanced beyond the slow region to its last logged time of
15.944203125000001 before the interrupt; this was a demonstrated mode-selection
defect, not a permanently stalled process. It has no completed trajectory.

A separate geometric mode now keeps nearby cam faces in impact integration
even when their current reaction is zero. It changes neither the physical
impulses nor their force audit. The actual active constraint rank still decides
whether both angular velocities are fixed; proximity alone does not establish
that rank. The same bounded return window now completes in 244 states with
one cam entry and five closing-contact subdivisions. A separate initial-pose
control also completes. The new full coarse run uses
`086-geometric-hybrid-coarse`; convergence against the completed fine run
remains pending. The old solver sources are unchanged and retained.

The fine trajectory's raw repeat check fails its 1e-8 velocity threshold at
an impact: adding the eight-second period lands 1.78e-15 seconds after the
corresponding saved knot and interpolates a tiny fraction of the impact jump.
The raw 3.192687054e-7 velocity difference remains reported. All 76,855 matching
phase knots are within 3.553e-15 seconds of saved counterparts. Matching these
knots directly, only within eight scaled machine epsilons, gives maximum
coordinate/velocity differences of 2.8422e-13 and 8.7264e-14. The unchanged
1e-8 thresholds then pass; no physically distinct event times are merged.
The seam itself matches to 3.886e-16 in coordinates and 4.219e-15 in velocity.
Compression now uses this timestamp matching, but has not yet run on the new
trajectory. Its full clearance and rope-deformation checks remain required.

## Combined continuous motion qualification

The geometric-mode coarse study finishes all 16 seconds with 187,668 states
and no solver failures. The completed fine trajectory remains the display
reference. Their finest-knot displacement bounds are 0.018609346 pixels for
the rigid apparatus and 0.175018238 pixels for the full 3D rope. Both pass;
the different integration-mode selectors retain the same physical geometry,
forces, loads and unilateral contact solver.

The first hybrid compression retains 2,582 poses. Its rope comparison exposes
0.030239400 pixels near take-up, so the final compression tightens the rigid
tolerance to 0.0005 pixels and retains 4,988 poses. All 4,987 playback intervals
pass continuous separation for the seven primary prism pairs. Renewed bounds
cover the other 629 independent rigid pairs and all 41 rope/hardware pairs.
The renewed self-clearance bound includes both the large slack bow and the
raised quiet bow. Actual mesh checks at 204 poses give a maximum polygonal
rope-length deficit of 3.61436e-6, below 1e-5.

The new deformation bound covers the actual polygonal tube between time knots.
On wrapped intervals the available slack is linear in the pose coordinates.
A bound on the second derivative of the unwound lead quadrature covers
unwrapped and crossing intervals. Monotone extra-length solves bound amplitude
and section orientation. Fixed lead/bow connectivity extends vertex bounds to
triangle interiors; a separate arc interpolation and triangulation allowance
covers changing winding-section counts. Small suppressed arcs and Float32
rounding are included. Controls compare independent amplitudes and 7,392,025
actual mesh vertices at 305 poses, and reject invalid domains.

The first interval attempt fails because its quiet-bow lower bound is always
zero, even at an almost constant positive amplitude. Independent quadratic
upper/lower bounds resolve that excessive width. A second attempt retains a
separate 0.025-pixel compression allocation and fails near take-up. Both failed
reports, traces and their exact source snapshots remain preserved. The final
check sums step-agreement and compression bounds on each common interval and
applies the original combined 0.25-pixel target. This accounts for the fact
that their largest differences occur at different instants; it changes neither
the target nor the supplied motion.

All 392,236 common intervals pass. The rope proof uses 393,481 accepted
subintervals, with maximum summed displacement 0.249935584 pixels. A separate
convex weighted-angle/translation proof covers the entire rigid motion, with
maximum summed displacement 0.018694353 pixels. These bounds compare the
supplied numerical/display profiles; they are not exact continuum-error
guarantees. The full rope trace is retained.

Ten additional source, lift, oblique-slack and loop-seam views are inspected
across two captures of the final profile. The first capture overlaps numerical
jobs and measures 12.67 fps with 3.4 ms p95 updates. Once those jobs finish,
the final capture measures 22.48 fps and 1.9 ms p95 updates over 12.233 seconds.
Both use SwiftShader at pixel ratio two and have no browser errors or unexpected
warnings. The input revolution still takes four display seconds. No hardware
GPU measurement or new production browser acceptance is implied.

The complete candidate now has qualified source geometry, finite-contact
motion, force/work/repeat evidence, continuous rigid and deforming-rope bounds,
and inspected rendering. `086-qualified-motion-checkpoint.json` records the
accepted reports and retained failures. Production integration remains pending.

## Remaining work and checkpoints

Integrate the qualified complete candidate, establish exact geometry and motion
parity in production, then run the focused and regression checks and inspect
the integrated desktop/mobile rendering. The omitted load, bearing-loss,
hidden-depth, rear input and winding details remain explicit reconstruction
assumptions. Movement 086 is not yet marked verified in production.

`086-first-study-checkpoint.json` records the inspected evidence and frozen
study sources. All 972 production inputs, 71 current movement 083 sources and
43 current movement 082 sources remain unchanged. No production build,
full numerical-suite pass or integration pass is claimed for this study.

`086-dynamics-study-checkpoint.json` records current diagnostic sources and
verifies historical studies against their retained source snapshots. Earlier
solver versions are not represented as the current implementation. The 23
original core-study sources, all 972 production inputs and the unfinished
082/083 studies remain unchanged. No browser was launched for this dynamics
checkpoint, and no new visual or integration acceptance is claimed.
The initial `086-second-study-checkpoint.json` is superseded because it
classified editable review Markdown as immutable evidence; the corrected
checkpoint retains a separate Markdown snapshot.

`086-impact-study-checkpoint.json` records the impact/face corrections,
adversarial controls, rejected refinements and nine inspected motion images.
Historical sources are verified against their own snapshots. All 972
production inputs, the 23 original core-study sources and the 082/083 studies
remain unchanged. The owned browser and all study processes are terminal.

`086-rear-drive-study-checkpoint.json` records the completed rear input
geometry, corner-seed controls, slower capture studies, weighted/load trials
and sixteen new inspected images. The latest force, work and sampled geometry
checks pass, but repeated operation remains rejected. Historical sources are
verified against their retained snapshots. The original 23 core-study inputs,
all 972 production inputs and the 082/083 studies remain unchanged. No new
production build or full-suite pass is claimed.
