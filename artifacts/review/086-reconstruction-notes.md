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

## Remaining work and checkpoints

Qualify the combined input, winding, rope and guided pump hardware. Its
free-body masses have been recomputed; the rear belt interpretation and
omitted output hardware remain reconstruction assumptions.

Establish refined agreement for the repeated capture, release and return,
including cold-start impulses. The omitted load, bearing-loss, hidden-depth
and winding assumptions still need qualification with the complete hardware;
the repeating coarse run alone is insufficient. Establish time-step agreement,
continuous clearance and readable playback. Refine
the rope tessellation, and integrate only after those checks,
then validate production.

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
